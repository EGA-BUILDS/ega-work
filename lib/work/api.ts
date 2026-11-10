import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { markNoStore } from '@/lib/auth/http';
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
 * Rejects cross-site state-changing requests. Same-origin browser requests carry
 * an Origin header; requests with no Origin are accepted only when the browser
 * did not mark them cross-site.
 */
export function isSameOrigin(request: NextRequest): boolean {
   if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return false;
   }
   const origin = request.headers.get('origin');
   if (!origin) {
      return true;
   }
   try {
      return new URL(origin).origin === request.nextUrl.origin;
   } catch {
      return false;
   }
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
   if (!result?.data.user) {
      return { ok: false, response: jsonError(401, 'Sign in to continue.') };
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
