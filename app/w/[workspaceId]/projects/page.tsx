import Link from 'next/link';

import { DataErrorState } from '@/components/work/data-error';
import { ProjectCreateForm } from '@/components/work/project-create-form';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listProjects } from '@/lib/work/data';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
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
      const projects = await listProjects(context.supabase, workspaceId);

      return (
         <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
            <div>
               <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
               <p className="text-muted-foreground mt-1 text-sm">
                  Saved projects in {context.workspace.name}.
               </p>
            </div>

            <ProjectCreateForm workspaceId={workspaceId} />

            <section className="flex flex-col gap-3">
               <h2 className="text-lg font-semibold">Saved projects</h2>
               {projects.length === 0 ? (
                  <Card>
                     <CardHeader>
                        <CardTitle>No projects yet</CardTitle>
                        <CardDescription>
                           Use the form above to create your first project.
                        </CardDescription>
                     </CardHeader>
                  </Card>
               ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                     {projects.map((project) => (
                        <Link
                           key={project.id}
                           href={`/w/${workspaceId}/projects/${project.id}`}
                           className="bg-card hover:bg-accent/40 rounded-lg border p-4 transition-colors"
                        >
                           <div className="flex items-start justify-between gap-3">
                              <p className="font-medium">{project.name}</p>
                              <span className="text-muted-foreground text-xs">
                                 v{project.version}
                              </span>
                           </div>
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
