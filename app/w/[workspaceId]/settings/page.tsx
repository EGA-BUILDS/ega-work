import { GithubSettings } from '@/components/work/github-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { githubAppInstallUrl, readGithubConfig } from '@/lib/work/github/config';
import { getGithubStatus } from '@/lib/work/github/service';
import { loadWorkspacePage } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

type GithubNotice = 'connected' | 'denied' | 'error' | 'setup' | null;

const GITHUB_NOTICES = new Set<GithubNotice>(['connected', 'denied', 'error', 'setup']);

function githubNotice(value: string | string[] | undefined): GithubNotice {
   const first = Array.isArray(value) ? value[0] : value;
   if (!first) {
      return null;
   }
   return GITHUB_NOTICES.has(first as GithubNotice) ? (first as GithubNotice) : null;
}

export default async function WorkspaceSettingsPage({
   params,
   searchParams,
}: {
   params: Promise<{ workspaceId: string }>;
   searchParams: Promise<{ github?: string | string[] }>;
}) {
   const { workspaceId } = await params;
   const context = await loadWorkspacePage(workspaceId);
   if (context.kind !== 'ok') {
      return null;
   }

   const query = await searchParams;
   const status = await getGithubStatus(context.workspace.id);
   const config = readGithubConfig();
   const installUrl = config.configured ? githubAppInstallUrl(config.config) : null;

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

         <GithubSettings
            workspaceId={context.workspace.id}
            initialStatus={status}
            installUrl={installUrl}
            notice={githubNotice(query.github)}
         />

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
