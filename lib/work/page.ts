import 'server-only';

import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loginPath } from '@/lib/auth/redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { getWorkspaceForUser } from './auth';
import type { WorkWorkspace } from './types';

export type WorkspacePageContext =
   | {
        kind: 'ok';
        supabase: SupabaseClient;
        user: User;
        workspace: WorkWorkspace;
     }
   | { kind: 'config' }
   | { kind: 'unavailable' };

/**
 * Resolves the verified user and their workspace for a private page. Missing
 * configuration is rendered honestly; a missing session goes to login; another
 * user's workspace identifier becomes a 404 without exposing whether it exists.
 */
export async function loadWorkspacePage(workspaceId: string): Promise<WorkspacePageContext> {
   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return { kind: 'config' };
   }

   const result = await supabase.auth.getUser().catch(() => null);
   if (!result) {
      return { kind: 'unavailable' };
   }

   const { data, error } = result;
   if (!data.user) {
      if (error?.name === 'AuthSessionMissingError' || !error) {
         redirect(loginPath(`/w/${workspaceId}`));
      }
      return { kind: 'unavailable' };
   }

   const lookup = await getWorkspaceForUser(supabase, data.user.id, workspaceId);
   if (!lookup.ok) {
      if (lookup.reason === 'not_found') {
         notFound();
      }
      return { kind: 'unavailable' };
   }

   return { kind: 'ok', supabase, user: data.user, workspace: lookup.workspace };
}

export type AccountContext =
   | { kind: 'ok'; supabase: SupabaseClient; user: User }
   | { kind: 'config' }
   | { kind: 'unavailable' };

export async function loadAccount(nextPath = '/me'): Promise<AccountContext> {
   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return { kind: 'config' };
   }

   const result = await supabase.auth.getUser().catch(() => null);
   if (!result) {
      return { kind: 'unavailable' };
   }

   const { data, error } = result;
   if (!data.user) {
      if (error?.name === 'AuthSessionMissingError' || !error) {
         redirect(loginPath(nextPath));
      }
      return { kind: 'unavailable' };
   }

   return { kind: 'ok', supabase, user: data.user };
}
