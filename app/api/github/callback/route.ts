import { NextResponse, type NextRequest } from 'next/server';

import { markNoStore } from '@/lib/auth/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requestSiteOrigin } from '@/lib/work/api';
import { readGithubConfig } from '@/lib/work/github/config';
import {
   completeGithubConnect,
   consumeGithubState,
   type GithubServiceErrorCode,
} from '@/lib/work/github/service';
import { isUuid } from '@/lib/work/github/url';

export const dynamic = 'force-dynamic';

function redirectTo(path: string): NextResponse {
   return markNoStore(new NextResponse(null, { status: 307, headers: { Location: path } }));
}

function settingsPath(workspaceId: string | null, outcome: string): string {
   return isUuid(workspaceId) ? `/w/${workspaceId}/settings?github=${outcome}` : '/login';
}

function failureOutcome(code: GithubServiceErrorCode): string {
   return code === 'denied' ? 'denied' : 'error';
}

/**
 * GitHub authorization callback.
 *
 * This is a top-level cross-site navigation from GitHub, so it deliberately
 * does not apply the same-origin check. Identity still comes only from the
 * verified Supabase session. The one-time state row is consumed before any
 * token exchange, the PKCE verifier is decrypted server-side, and every
 * redirect target is reconstructed from a stored workspace id. `code`,
 * `state`, and provider error text are never echoed.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
   if (!readGithubConfig().configured) {
      return redirectTo('/login');
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return redirectTo('/login');
   }

   const result = await supabase.auth.getUser().catch(() => null);
   const user = result?.data.user;
   if (!user) {
      return redirectTo('/login');
   }

   const params = request.nextUrl.searchParams;
   const state = params.get('state') ?? '';
   const code = params.get('code');
   const denied = params.get('error');

   if (denied || !code) {
      const workspaceId = state ? await consumeGithubState(user.id, state) : null;
      return redirectTo(settingsPath(workspaceId, 'denied'));
   }

   const origin = requestSiteOrigin(request);
   if (!origin) {
      return redirectTo('/login');
   }

   const completed = await completeGithubConnect({
      userId: user.id,
      origin,
      code,
      state,
   });

   if (completed.ok) {
      return redirectTo(settingsPath(completed.workspaceId, 'connected'));
   }

   return redirectTo(settingsPath(completed.workspaceId, failureOutcome(completed.code)));
}
