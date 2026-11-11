import { NextResponse } from 'next/server';

import { markNoStore } from '@/lib/auth/http';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrCreateWorkspace } from '@/lib/work/auth';
import { readGithubConfig } from '@/lib/work/github/config';

export const dynamic = 'force-dynamic';

function redirectTo(path: string): NextResponse {
   return markNoStore(new NextResponse(null, { status: 307, headers: { Location: path } }));
}

/**
 * GitHub App setup URL.
 *
 * The `installation_id` query value is an untrusted hint and is not read or
 * bound here. Installation selection only accepts ids returned by the verified
 * `GET /user/installations` enumeration.
 */
export async function GET(): Promise<NextResponse> {
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

   const workspace = await getOrCreateWorkspace(supabase, user);
   if (!workspace.ok) {
      return redirectTo('/me');
   }

   return redirectTo(`/w/${workspace.workspace.id}/settings?github=setup`);
}
