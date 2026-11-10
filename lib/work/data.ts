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

function normalizeIssue(row: WorkIssue): WorkIssue {
   return { ...row, number: Number(row.number) };
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
   return ((data ?? []) as WorkIssue[]).map(normalizeIssue);
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
   return ((data ?? []) as WorkIssue[]).map(normalizeIssue);
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
   return normalizeIssue(data as WorkIssue);
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
   return normalizeIssue(data as WorkIssue);
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
   return normalizeIssue(data as WorkIssue);
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
   return normalizeIssue(data as WorkIssue);
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
