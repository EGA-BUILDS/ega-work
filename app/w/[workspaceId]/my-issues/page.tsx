import Link from 'next/link';

import { DataErrorState } from '@/components/work/data-error';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listAssignedIssues, listProjects } from '@/lib/work/data';
import { loadWorkspacePage } from '@/lib/work/page';
import { issueIdentifier } from '@/lib/work/validation';

export const dynamic = 'force-dynamic';

export default async function MyIssuesPage({
   params,
}: {
   params: Promise<{ workspaceId: string }>;
}) {
   const { workspaceId } = await params;
   const context = await loadWorkspacePage(workspaceId);
   if (context.kind !== 'ok') {
      return null;
   }

   try {
      const [issues, projects] = await Promise.all([
         listAssignedIssues(context.supabase, workspaceId, context.user.id),
         listProjects(context.supabase, workspaceId),
      ]);
      const projectNames = new Map(projects.map((project) => [project.id, project.name]));
      const open = issues.filter((issue) => issue.status === 'open');
      const completed = issues.filter((issue) => issue.status === 'completed');

      function issueRows(items: typeof issues) {
         return items.map((issue) => (
            <Link
               key={issue.id}
               href={`/w/${workspaceId}/issues/${issue.id}`}
               className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
            >
               <span className="text-muted-foreground w-14 shrink-0 font-mono text-xs">
                  {issueIdentifier(issue.number)}
               </span>
               <span className="min-w-0 flex-1 truncate text-sm font-medium">{issue.title}</span>
               <span className="text-muted-foreground hidden truncate text-xs sm:block">
                  {projectNames.get(issue.project_id) ?? 'Project'}
               </span>
               <Badge variant={issue.status === 'completed' ? 'secondary' : 'outline'}>
                  {issue.status === 'completed' ? 'Completed' : 'Open'}
               </Badge>
            </Link>
         ));
      }

      return (
         <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <div>
               <h1 className="text-2xl font-semibold tracking-tight">My issues</h1>
               <p className="text-muted-foreground mt-1 text-sm">
                  Issues assigned to {context.user.email ?? 'you'} in {context.workspace.name}.
               </p>
            </div>

            {issues.length === 0 ? (
               <Card>
                  <CardHeader>
                     <CardTitle>No assigned issues yet</CardTitle>
                     <CardDescription>
                        Create an issue in a project and it will appear here.
                     </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Link
                        href={`/w/${workspaceId}/projects`}
                        className="text-sm underline underline-offset-4"
                     >
                        Go to projects
                     </Link>
                  </CardContent>
               </Card>
            ) : (
               <>
                  <section className="flex flex-col gap-2">
                     <h2 className="text-lg font-semibold">Open ({open.length})</h2>
                     <Card>
                        <CardContent className="divide-y p-0">
                           {open.length === 0 ? (
                              <p className="text-muted-foreground px-4 py-3 text-sm">
                                 No open issues.
                              </p>
                           ) : (
                              issueRows(open)
                           )}
                        </CardContent>
                     </Card>
                  </section>
                  <section className="flex flex-col gap-2">
                     <h2 className="text-lg font-semibold">Completed ({completed.length})</h2>
                     <Card>
                        <CardContent className="divide-y p-0">
                           {completed.length === 0 ? (
                              <p className="text-muted-foreground px-4 py-3 text-sm">
                                 No completed issues.
                              </p>
                           ) : (
                              issueRows(completed)
                           )}
                        </CardContent>
                     </Card>
                  </section>
               </>
            )}
         </div>
      );
   } catch {
      return <DataErrorState workspaceId={workspaceId} />;
   }
}
