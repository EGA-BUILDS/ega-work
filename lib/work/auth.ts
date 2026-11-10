import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { WorkWorkspace } from './types';

export type WorkspaceLookup =
   | { ok: true; workspace: WorkWorkspace }
   | { ok: false; reason: 'not_found' | 'unavailable' };

export type WorkspaceBootstrap =
   | { ok: true; workspace: WorkWorkspace }
   | { ok: false; reason: 'unavailable' };

export function defaultWorkspaceName(user: User): string {
   const metadata = user.user_metadata;
   const name =
      typeof metadata?.full_name === 'string'
         ? metadata.full_name.trim()
         : typeof metadata?.name === 'string'
           ? metadata.name.trim()
           : '';
   if (name) {
      return `${name.split(/\s+/)[0]}'s workspace`;
   }
   return 'My workspace';
}

/**
 * Reads one workspace through the request-scoped Supabase client. RLS already
 * restricts rows to the signed-in owner; the owner filter is a second check so
 * a misconfigured policy cannot turn a guessed identifier into access.
 */
export async function getWorkspaceForUser(
   supabase: SupabaseClient,
   userId: string,
   workspaceId: string
): Promise<WorkspaceLookup> {
   const { data, error } = await supabase
      .from('work_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('owner_id', userId)
      .maybeSingle();

   if (error) {
      return { ok: false, reason: 'unavailable' };
   }
   if (!data) {
      return { ok: false, reason: 'not_found' };
   }
   return { ok: true, workspace: data as WorkWorkspace };
}

/**
 * Creates the signed-in user's workspace once. The unique owner constraint and
 * `ignoreDuplicates` make repeated or concurrent entry safe.
 */
export async function getOrCreateWorkspace(
   supabase: SupabaseClient,
   user: User
): Promise<WorkspaceBootstrap> {
   const { error } = await supabase.from('work_workspaces').upsert(
      {
         owner_id: user.id,
         name: defaultWorkspaceName(user),
      },
      { onConflict: 'owner_id', ignoreDuplicates: true }
   );

   if (error) {
      return { ok: false, reason: 'unavailable' };
   }

   const { data, error: readError } = await supabase
      .from('work_workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

   if (readError || !data) {
      return { ok: false, reason: 'unavailable' };
   }

   return { ok: true, workspace: data as WorkWorkspace };
}
