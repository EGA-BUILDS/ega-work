import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorkIssue, WorkIssueStatus, WorkProject } from './types';

export type WorkDataErrorCode = 'unavailable' | 'not_found' | 'conflict';

export class WorkDataError extends Error {
   constructor(readonly code: WorkDataErrorCode) {
      super(code);
      this.name = 'WorkDataError';
   }
}

function unavailable(): never {
   throw new WorkDataError('unavailable');
}

function notFound(): never {
   throw new WorkDataError('not_found');
}

function conflict(): never {
   throw new WorkDataError('conflict');
}

export async function listProjects(
   supabase: SupabaseClient,
   workspaceId: string
): Promise<WorkProject[]> {
   const { data, error } = await supabase
      .from('work_projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

   if (error) unavailable();
   return (data ?? []) as WorkProject[];
}

export async function getProject(
   supabase: SupabaseClient,
   workspaceId: string,
   projectId: string
): Promise<WorkProject> {
   const { data, error } = await supabase
      .from('work_projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', projectId)
      .maybeSingle();

   if (error) unavailable();
   if (!data) notFound();
   return data as WorkProject;
}

export async function createProject(
   supabase: SupabaseClient,
   workspaceId: string,
   input: { name: string; description: string | null }
): Promise<WorkProject> {
   const { data, error } = await supabase
      .from('work_projects')
      .insert({ workspace_id: workspaceId, name: input.name, description: input.description })
      .select('*')
      .single();

   if (error || !data) unavailable();
   return data as WorkProject;
}

export async function updateProject(
   supabase: SupabaseClient,
   workspaceId: string,
   projectId: string,
   expectedVersion: number,
   input: { name: string; description: string | null }
): Promise<WorkProject> {
   const { data, error } = await supabase
      .from('work_projects')
      .update({
         name: input.name,
         description: input.description,
         version: expectedVersion + 1,
         updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', projectId)
      .eq('version', expectedVersion)
      .select('*')
      .maybeSingle();

   if (error) unavailable();
   if (!data) conflict();
   return data as WorkProject;
}

export async function listProjectIssues(
   supabase: SupabaseClient,
   workspaceId: string,
   projectId: string
): Promise<WorkIssue[]> {
   const { data, error } = await supabase
      .from('work_issues')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('project_id', projectId)
      .order('number', { ascending: false });

   if (error) unavailable();
   return (data ?? []) as WorkIssue[];
}

export async function listAssignedIssues(
   supabase: SupabaseClient,
   workspaceId: string,
   userId: string
): Promise<WorkIssue[]> {
   const { data, error } = await supabase
      .from('work_issues')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('assignee_id', userId)
      .order('updated_at', { ascending: false });

   if (error) unavailable();
   return (data ?? []) as WorkIssue[];
}

export async function getIssue(
   supabase: SupabaseClient,
   workspaceId: string,
   issueId: string
): Promise<WorkIssue> {
   const { data, error } = await supabase
      .from('work_issues')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', issueId)
      .maybeSingle();

   if (error) unavailable();
   if (!data) notFound();
   return data as WorkIssue;
}

export async function createIssue(
   supabase: SupabaseClient,
   workspaceId: string,
   projectId: string,
   userId: string,
   input: { title: string; description: string | null }
): Promise<WorkIssue> {
   await getProject(supabase, workspaceId, projectId);

   const { data, error } = await supabase
      .from('work_issues')
      .insert({
         workspace_id: workspaceId,
         project_id: projectId,
         title: input.title,
         description: input.description,
         status: 'open',
         assignee_id: userId,
      })
      .select('*')
      .single();

   if (error || !data) unavailable();
   return { ...(data as WorkIssue), number: Number((data as WorkIssue).number) };
}

export async function updateIssue(
   supabase: SupabaseClient,
   workspaceId: string,
   issueId: string,
   expectedVersion: number,
   input: { title: string; description: string | null }
): Promise<WorkIssue> {
   const { data, error } = await supabase
      .from('work_issues')
      .update({
         title: input.title,
         description: input.description,
         version: expectedVersion + 1,
         updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', issueId)
      .eq('version', expectedVersion)
      .select('*')
      .maybeSingle();

   if (error) unavailable();
   if (!data) conflict();
   return { ...(data as WorkIssue), number: Number((data as WorkIssue).number) };
}

export async function setIssueStatus(
   supabase: SupabaseClient,
   workspaceId: string,
   issueId: string,
   expectedVersion: number,
   status: WorkIssueStatus
): Promise<WorkIssue> {
   const { data, error } = await supabase
      .from('work_issues')
      .update({ status, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', issueId)
      .eq('version', expectedVersion)
      .select('*')
      .maybeSingle();

   if (error) unavailable();
   if (!data) conflict();
   return { ...(data as WorkIssue), number: Number((data as WorkIssue).number) };
}

export async function countProjects(
   supabase: SupabaseClient,
   workspaceId: string
): Promise<number> {
   const { count, error } = await supabase
      .from('work_projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);
   if (error) unavailable();
   return count ?? 0;
}

export async function countOpenIssues(
   supabase: SupabaseClient,
   workspaceId: string
): Promise<number> {
   const { count, error } = await supabase
      .from('work_issues')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'open');
   if (error) unavailable();
   return count ?? 0;
}

export type WorkspaceSearchResults = {
   projects: WorkProject[];
   issues: WorkIssue[];
};

export async function searchWorkspace(
   supabase: SupabaseClient,
   workspaceId: string,
   rawQuery: string
): Promise<WorkspaceSearchResults> {
   const query = rawQuery.trim().slice(0, 100);
   if (!query) {
      return { projects: [], issues: [] };
   }

   const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
   const { data: projects, error: projectError } = await supabase
      .from('work_projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .ilike('name', pattern)
      .order('updated_at', { ascending: false })
      .limit(10);
   if (projectError) unavailable();

   const { data: titled, error: titleError } = await supabase
      .from('work_issues')
      .select('*')
      .eq('workspace_id', workspaceId)
      .ilike('title', pattern)
      .order('updated_at', { ascending: false })
      .limit(10);
   if (titleError) unavailable();

   const identifier = /^w-(\d+)$/i.exec(query);
   let byNumber: WorkIssue[] = [];
   if (identifier) {
      const { data, error } = await supabase
         .from('work_issues')
         .select('*')
         .eq('workspace_id', workspaceId)
         .eq('number', Number(identifier[1]))
         .limit(1);
      if (error) unavailable();
      byNumber = (data ?? []) as WorkIssue[];
   }

   const issues = [...byNumber, ...((titled ?? []) as WorkIssue[])]
      .filter(
         (issue, index, all) => all.findIndex((candidate) => candidate.id === issue.id) === index
      )
      .map((issue) => ({ ...issue, number: Number(issue.number) }))
      .slice(0, 10);

   return { projects: (projects ?? []) as WorkProject[], issues };
}
