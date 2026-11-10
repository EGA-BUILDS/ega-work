import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { DemoBanner } from '@/components/home/demo-banner';
import { DEFAULT_ORG_ID } from '@/components/home/demo-data';
import { WorkspaceConfigState, WorkspaceUnavailableState } from '@/components/work/workspace-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getOrCreateWorkspace } from '@/lib/work/auth';
import { loadAccount } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

/**
 * `/[orgId]` handles two cases. The Circle fixture organization is the public,
 * labeled demo and renders sample data with a persistent notice. Every other
 * organization path is not part of the private workspace and renders an honest
 * unavailable state, so a direct URL cannot surface fixtures as personal data.
 */
export default async function LegacyCircleLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: Promise<{ orgId: string }>;
}) {
   const { orgId } = await params;

   // The Circle fixture interface is the public, labeled demo. It is separate
   // from `/w/<workspaceId>` and never reads private workspace records.
   if (orgId === DEFAULT_ORG_ID) {
      return (
         <>
            {children}
            <DemoBanner />
         </>
      );
   }

   const account = await loadAccount('/me');

   if (account.kind === 'config') {
      return <WorkspaceConfigState />;
   }
   if (account.kind === 'unavailable') {
      return <WorkspaceUnavailableState />;
   }

   const workspace = await getOrCreateWorkspace(account.supabase, account.user);
   if (!workspace.ok) {
      return <WorkspaceUnavailableState />;
   }

   return (
      <AuthShell>
         <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            <Alert>
               <AlertTitle>This Circle section is not part of the private workspace</AlertTitle>
               <AlertDescription>
                  The demo sections are not connected to saved Work data. Use your workspace for
                  projects and issues, or open the separately labeled demo.
               </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
               <Button asChild>
                  <Link href={`/w/${workspace.workspace.id}/projects`}>Go to your workspace</Link>
               </Button>
               <Button variant="outline" asChild>
                  <Link href="/demo">Open labeled demo</Link>
               </Button>
            </div>
         </div>
      </AuthShell>
   );
}
