import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { markNoStore } from '@/lib/auth/http';
import { isTrustedRequestOrigin } from '@/lib/auth/request-origin';
import { resolveSiteOrigin } from '@/lib/auth/site-origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { getWorkspaceForUser } from './auth';
import { WorkDataError } from './data';
import type { WorkWorkspace } from './types';

export type ApiContext = {
   supabase: SupabaseClient;
   user: User;
   workspace: WorkWorkspace;
};

type ApiContextResult = { ok: true; context: ApiContext } | { ok: false; response: NextResponse };

export function jsonResponse(body: unknown, status = 200): NextResponse {
   return markNoStore(NextResponse.json(body, { status }));
}

export function jsonError(status: number, message: string): NextResponse {
   return jsonResponse({ error: message }, status);
}

/**
 * Resolves the trusted public origin for this request. The expected origin is
 * resolved from configured `SITE_URL` or trusted public headers, not Next's
 * internal request origin, so direct 127.0.0.1 use and reverse proxies work.
 */
export function requestSiteOrigin(request: NextRequest): string | null {
   const expected = resolveSiteOrigin({
      configured: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      host: request.headers.get('host'),
      defaultProtocol: request.nextUrl.protocol === 'http:' ? 'http' : 'https',
   });

   return expected.ok ? expected.origin : null;
}

/**
 * Rejects cross-site state-changing requests.
 */
export function isSameOrigin(request: NextRequest): boolean {
   return isTrustedRequestOrigin({
      origin: request.headers.get('origin'),
      fetchSite: request.headers.get('sec-fetch-site'),
      expectedOrigin: requestSiteOrigin(request),
   });
}

export async function resolveApiContext(
   request: NextRequest,
   workspaceId: string
): Promise<ApiContextResult> {
   if (!isSameOrigin(request)) {
      return { ok: false, response: jsonError(403, 'This request was not accepted.') };
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return { ok: false, response: jsonError(503, 'Workspace storage is not configured.') };
   }

   const result = await supabase.auth.getUser().catch(() => null);
   if (!result) {
      return { ok: false, response: jsonError(503, 'Workspace storage is unavailable.') };
   }
   if (!result.data.user) {
      if (result.error?.name === 'AuthSessionMissingError' || !result.error) {
         return { ok: false, response: jsonError(401, 'Sign in to continue.') };
      }
      return { ok: false, response: jsonError(503, 'Workspace storage is unavailable.') };
   }

   const lookup = await getWorkspaceForUser(supabase, result.data.user.id, workspaceId);
   if (!lookup.ok) {
      return {
         ok: false,
         response:
            lookup.reason === 'not_found'
               ? jsonError(404, 'Workspace not found.')
               : jsonError(503, 'Workspace storage is unavailable.'),
      };
   }

   return {
      ok: true,
      context: { supabase, user: result.data.user, workspace: lookup.workspace },
   };
}

export function dataErrorResponse(error: unknown): NextResponse {
   if (error instanceof WorkDataError) {
      if (error.code === 'not_found') {
         return jsonError(404, 'Not found.');
      }
      if (error.code === 'conflict') {
         return jsonError(409, 'This record changed. Reload and try again.');
      }
   }
   return jsonError(503, 'The save did not complete. Try again.');
}

export async function readJsonObject(
   request: NextRequest
): Promise<Record<string, unknown> | null> {
   try {
      const body: unknown = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
         return null;
      }
      return body as Record<string, unknown>;
   } catch {
      return null;
   }
}
