import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export default async function WorkspaceSettingsPage({
   params,
}: {
   params: Promise<{ workspaceId: string }>;
}) {
   const { workspaceId } = await params;
   const context = await loadWorkspacePage(workspaceId);
   if (context.kind !== 'ok') {
      return null;
   }

   return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
         <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm">
               Private workspace and account details.
            </p>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Workspace</CardTitle>
               <CardDescription>
                  One private workspace is created per verified account.
               </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
               <div className="grid gap-1">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{context.workspace.name}</span>
               </div>
               <div className="grid gap-1">
                  <span className="text-muted-foreground">Workspace ID</span>
                  <span className="font-mono text-xs break-all">{context.workspace.id}</span>
               </div>
               <div className="grid gap-1">
                  <span className="text-muted-foreground">Signed in as</span>
                  <span className="font-medium break-all">
                     {context.user.email ?? 'No email on this account'}
                  </span>
               </div>
               <div className="grid gap-1">
                  <span className="text-muted-foreground">Account ID</span>
                  <span className="font-mono text-xs break-all">{context.user.id}</span>
               </div>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  GitHub <Badge variant="secondary">Not connected</Badge>
               </CardTitle>
               <CardDescription>
                  GitHub authorization is not configured in this environment. Pull-request linking
                  and refresh stay unavailable until a provider connection is configured. Completing
                  an issue never depends on GitHub.
               </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
               <Button variant="outline" disabled>
                  Connect GitHub
               </Button>
               <Button variant="ghost" asChild>
                  <Link href="/demo" target="_blank" rel="noopener noreferrer">
                     View labeled demo
                  </Link>
               </Button>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Session</CardTitle>
               <CardDescription>
                  Signing out clears this browser session. Private pages require a verified session.
               </CardDescription>
            </CardHeader>
            <CardContent>
               <form action="/auth/signout" method="post">
                  <Button type="submit" variant="outline">
                     Sign out
                  </Button>
               </form>
            </CardContent>
         </Card>
      </div>
   );
}
