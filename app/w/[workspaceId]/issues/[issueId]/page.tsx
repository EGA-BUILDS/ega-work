import { notFound } from 'next/navigation';

import { DataErrorState } from '@/components/work/data-error';
import { IssueDetail } from '@/components/work/issue-detail';
import { WorkDataError, getIssue, getProject } from '@/lib/work/data';
import { getGithubIssueView } from '@/lib/work/github/service';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export default async function IssuePage({
   params,
}: {
   params: Promise<{ workspaceId: string; issueId: string }>;
}) {
   const { workspaceId, issueId } = await params;
   const context = await loadWorkspacePage(workspaceId);
   if (context.kind !== 'ok') {
      return null;
   }

   try {
      const issue = await getIssue(context.supabase, workspaceId, issueId);
      const project = await getProject(context.supabase, workspaceId, issue.project_id);
      const githubView = await getGithubIssueView(workspaceId, issueId);

      return (
         <IssueDetail
            workspaceId={workspaceId}
            projectName={project.name}
            issue={issue}
            githubView={githubView}
         />
      );
   } catch (error) {
      if (error instanceof WorkDataError && error.code === 'not_found') {
         notFound();
      }
      return <DataErrorState workspaceId={workspaceId} />;
   }
}
