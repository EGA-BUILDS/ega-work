import Link from 'next/link';

import { DataErrorState } from '@/components/work/data-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { countOpenIssues, countProjects, listProjects } from '@/lib/work/data';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export default async function WorkspaceOverviewPage({
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
      const [projects, projectCount, openIssueCount] = await Promise.all([
         listProjects(context.supabase, workspaceId),
         countProjects(context.supabase, workspaceId),
         countOpenIssues(context.supabase, workspaceId),
      ]);

      return (
         <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
               <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                     {context.workspace.name}
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                     Private saved work for {context.user.email ?? 'your account'}.
                  </p>
               </div>
               <Button asChild>
                  <Link href={`/w/${workspaceId}/projects`}>New project</Link>
               </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
               <Card>
                  <CardHeader className="pb-2">
                     <CardDescription>Projects</CardDescription>
                     <CardTitle className="text-3xl">{projectCount}</CardTitle>
                  </CardHeader>
               </Card>
               <Card>
                  <CardHeader className="pb-2">
                     <CardDescription>Open issues</CardDescription>
                     <CardTitle className="text-3xl">{openIssueCount}</CardTitle>
                  </CardHeader>
               </Card>
               <Card>
                  <CardHeader className="pb-2">
                     <CardDescription>Workspace</CardDescription>
                     <CardTitle className="truncate text-base">{context.workspace.name}</CardTitle>
                  </CardHeader>
               </Card>
            </div>

            <section className="flex flex-col gap-3">
               <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Projects</h2>
                  <Button variant="outline" size="sm" asChild>
                     <Link href={`/w/${workspaceId}/projects`}>View all</Link>
                  </Button>
               </div>
               {projects.length === 0 ? (
                  <Card>
                     <CardHeader>
                        <CardTitle>No projects yet</CardTitle>
                        <CardDescription>
                           Create your first private project. It will be saved and will survive a
                           reload.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <Button asChild>
                           <Link href={`/w/${workspaceId}/projects`}>Create a project</Link>
                        </Button>
                     </CardContent>
                  </Card>
               ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                     {projects.slice(0, 6).map((project) => (
                        <Link
                           key={project.id}
                           href={`/w/${workspaceId}/projects/${project.id}`}
                           className="bg-card hover:bg-accent/40 rounded-lg border p-4 transition-colors"
                        >
                           <p className="font-medium">{project.name}</p>
                           <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                              {project.description || 'No description yet.'}
                           </p>
                        </Link>
                     ))}
                  </div>
               )}
            </section>
         </div>
      );
   } catch {
      return <DataErrorState workspaceId={workspaceId} />;
   }
}
