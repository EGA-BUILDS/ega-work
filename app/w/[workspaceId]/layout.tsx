import type { ReactNode } from 'react';

import { WorkspaceShell } from '@/components/work/workspace-shell';
import { WorkspaceConfigState, WorkspaceUnavailableState } from '@/components/work/workspace-state';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
   children,
   params,
}: {
   children: ReactNode;
   params: Promise<{ workspaceId: string }>;
}) {
   const { workspaceId } = await params;
   const context = await loadWorkspacePage(workspaceId);

   if (context.kind === 'config') {
      return <WorkspaceConfigState />;
   }
   if (context.kind === 'unavailable') {
      return <WorkspaceUnavailableState />;
   }

   return (
      <WorkspaceShell
         workspace={{ id: context.workspace.id, name: context.workspace.name }}
         user={{ email: context.user.email ?? null }}
      >
         {children}
      </WorkspaceShell>
   );
}
