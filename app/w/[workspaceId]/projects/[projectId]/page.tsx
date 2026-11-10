import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DataErrorState } from '@/components/work/data-error';
import { IssueCreateForm } from '@/components/work/issue-create-form';
import { ProjectEditForm } from '@/components/work/project-edit-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkDataError, getProject, listProjectIssues } from '@/lib/work/data';
import { loadWorkspacePage } from '@/lib/work/page';
import { issueIdentifier } from '@/lib/work/validation';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
   params,
}: {
   params: Promise<{ workspaceId: string; projectId: string }>;
}) {
   const { workspaceId, projectId } = await params;
   const context = await loadWorkspacePage(workspaceId);
   if (context.kind !== 'ok') {
      return null;
   }

   try {
      const [project, issues] = await Promise.all([
         getProject(context.supabase, workspaceId, projectId),
         listProjectIssues(context.supabase, workspaceId, projectId),
      ]);

      return (
         <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <div>
               <Link
                  href={`/w/${workspaceId}/projects`}
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
               >
                  ← All projects
               </Link>
               <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.name}</h1>
               <p className="text-muted-foreground mt-1 text-sm">
                  Saved project in {context.workspace.name}.
               </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
               <ProjectEditForm workspaceId={workspaceId} project={project} />
               <IssueCreateForm workspaceId={workspaceId} projectId={projectId} />
            </div>

            <section className="flex flex-col gap-3">
               <h2 className="text-lg font-semibold">Issues</h2>
               {issues.length === 0 ? (
                  <Card>
                     <CardHeader>
                        <CardTitle>No issues yet</CardTitle>
                        <CardDescription>
                           Create an issue above. It will appear here and in My issues.
                        </CardDescription>
                     </CardHeader>
                  </Card>
               ) : (
                  <Card>
                     <CardContent className="divide-y p-0">
                        {issues.map((issue) => (
                           <Link
                              key={issue.id}
                              href={`/w/${workspaceId}/issues/${issue.id}`}
                              className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
                           >
                              <span className="text-muted-foreground w-14 shrink-0 font-mono text-xs">
                                 {issueIdentifier(issue.number)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                 {issue.title}
                              </span>
                              <Badge
                                 variant={issue.status === 'completed' ? 'secondary' : 'outline'}
                              >
                                 {issue.status === 'completed' ? 'Completed' : 'Open'}
                              </Badge>
                           </Link>
                        ))}
                     </CardContent>
                  </Card>
               )}
            </section>
         </div>
      );
   } catch (error) {
      if (error instanceof WorkDataError && error.code === 'not_found') {
         notFound();
      }
      return <DataErrorState workspaceId={workspaceId} />;
   }
}
