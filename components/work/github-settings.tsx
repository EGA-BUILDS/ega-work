'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GithubInstallationView, GithubStatusView } from '@/lib/work/github/types';

type Notice = 'connected' | 'denied' | 'error' | 'setup' | null;

const NOTICES: Readonly<Record<Exclude<Notice, null>, string>> = {
   connected:
      'GitHub connected. Previously linked pull requests, if any, were hidden and must be relinked. Choose an installation to read pull requests.',
   denied: 'GitHub authorization was cancelled or expired. Try again.',
   error: 'GitHub authorization did not complete. Try again.',
   setup: 'GitHub App setup returned. Choose an installation below.',
};

function statusBadge(status: GithubStatusView['status']) {
   switch (status) {
      case 'connected':
         return <Badge>Connected</Badge>;
      case 'reauthorization_required':
         return <Badge variant="destructive">Reconnect needed</Badge>;
      case 'unconfigured':
         return <Badge variant="outline">Not configured</Badge>;
      case 'unavailable':
         return <Badge variant="destructive">Unavailable</Badge>;
      default:
         return <Badge variant="secondary">Not connected</Badge>;
   }
}

export function GithubSettings({
   workspaceId,
   initialStatus,
   installUrl,
   notice,
}: {
   workspaceId: string;
   initialStatus: GithubStatusView;
   installUrl: string | null;
   notice: Notice;
}) {
   const router = useRouter();
   const [status, setStatus] = useState(initialStatus);
   const [installations, setInstallations] = useState<GithubInstallationView[] | null>(null);
   const [busy, setBusy] = useState<'connect' | 'disconnect' | 'installations' | string | null>(
      null
   );
   const [error, setError] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(notice ? NOTICES[notice] : null);

   const refreshStatus = useCallback(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/github`, {
         headers: { Accept: 'application/json' },
         cache: 'no-store',
      });
      if (!response.ok) {
         return;
      }
      const payload = (await response.json().catch(() => null)) as GithubStatusView | null;
      if (payload) {
         setStatus(payload);
      }
   }, [workspaceId]);

   const loadInstallations = useCallback(async () => {
      setBusy('installations');
      setError(null);
      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/github/installations`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
         });
         const payload = (await response.json().catch(() => null)) as {
            installations?: GithubInstallationView[];
            error?: string;
         } | null;
         if (!response.ok || !payload?.installations) {
            setError(payload?.error ?? 'GitHub installations did not load.');
            await refreshStatus();
            return;
         }
         setInstallations(payload.installations);
      } catch {
         setError('GitHub installations did not load. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }, [refreshStatus, workspaceId]);

   useEffect(() => {
      setStatus(initialStatus);
      if (initialStatus.status !== 'connected') {
         setInstallations(null);
      }
   }, [initialStatus]);

   useEffect(() => {
      if (initialStatus.configured && initialStatus.status === 'connected') {
         void loadInstallations();
      }
   }, [initialStatus.configured, initialStatus.status, loadInstallations]);

   async function onConnect() {
      setBusy('connect');
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/github/connect`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
         });
         const payload = (await response.json().catch(() => null)) as {
            url?: string;
            error?: string;
         } | null;
         if (!response.ok || !payload?.url) {
            setError(payload?.error ?? 'GitHub authorization did not start. Try again.');
            return;
         }

         let url: URL;
         try {
            url = new URL(payload.url);
         } catch {
            setError('GitHub authorization did not start. Try again.');
            return;
         }
         if (url.origin !== 'https://github.com') {
            setError('GitHub authorization did not start. Try again.');
            return;
         }

         setMessage('Redirecting to GitHub…');
         window.location.assign(url.toString());
      } catch {
         setError('GitHub authorization did not start. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   async function onDisconnect() {
      setBusy('disconnect');
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/github/disconnect`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
         });
         const payload = (await response.json().catch(() => null)) as {
            status?: GithubStatusView;
            error?: string;
         } | null;
         if (!response.ok || !payload?.status) {
            setError(payload?.error ?? 'GitHub was not disconnected. Try again.');
            return;
         }
         setStatus(payload.status);
         setInstallations(null);
         setMessage('GitHub disconnected. Stored pull-request details are hidden.');
         router.refresh();
      } catch {
         setError('GitHub was not disconnected. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   async function onChooseInstallation(installationId: string) {
      setBusy(installationId);
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/github/installations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ installationId }),
         });
         const payload = (await response.json().catch(() => null)) as {
            status?: GithubStatusView;
            previousLinksHidden?: boolean;
            error?: string;
         } | null;
         if (!response.ok || !payload?.status) {
            setError(payload?.error ?? 'That installation was not selected.');
            await refreshStatus();
            return;
         }
         setStatus(payload.status);
         setMessage(
            payload.previousLinksHidden
               ? 'Installation selected. Previous pull-request links were hidden and must be relinked.'
               : 'Installation selected.'
         );
         router.refresh();
      } catch {
         setError('That installation was not selected. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   const connected = status.status === 'connected';
   const selected = installations?.find(
      (installation) => installation.id === status.installationId
   );

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
               GitHub {statusBadge(status.status)}
            </CardTitle>
            <CardDescription>
               Read-only pull-request metadata for this workspace. Work owns issue status; a merged
               pull request never completes an issue by itself.
            </CardDescription>
         </CardHeader>
         <CardContent className="flex flex-col gap-4">
            <div aria-live="polite" className="flex flex-col gap-2">
               {error ? (
                  <Alert variant="destructive">
                     <AlertDescription>{error}</AlertDescription>
                  </Alert>
               ) : null}
               {message ? (
                  <Alert>
                     <AlertDescription>{message}</AlertDescription>
                  </Alert>
               ) : null}
            </div>

            {status.status === 'unconfigured' ? (
               <p className="text-muted-foreground text-sm">
                  GitHub is not configured in this environment. Pull-request linking and refresh
                  stay unavailable until server-side GitHub App credentials and a restricted
                  database role are configured. Nothing here fakes a connection.
               </p>
            ) : null}

            {status.status === 'unavailable' ? (
               <p className="text-muted-foreground text-sm">
                  The GitHub integration store is unavailable, so no connection or pull-request
                  details can be shown. Issue completion is unaffected.
               </p>
            ) : null}

            {connected ? (
               <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="grid gap-1">
                     <span className="text-muted-foreground">GitHub account</span>
                     <span className="font-medium">{status.login}</span>
                  </div>
                  <div className="grid gap-1">
                     <span className="text-muted-foreground">App installation</span>
                     <span className="font-medium">
                        {selected
                           ? `${selected.accountLogin} (${selected.accountType})`
                           : status.installationId
                             ? `Installation ${status.installationId}`
                             : 'Not selected'}
                     </span>
                  </div>
               </div>
            ) : null}

            {connected ? (
               <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                     <span className="text-sm font-medium">Installation</span>
                     <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void loadInstallations()}
                        disabled={busy !== null}
                     >
                        {busy === 'installations' ? 'Checking…' : 'Check installations'}
                     </Button>
                  </div>

                  {installations === null && busy === 'installations' ? (
                     <Skeleton className="h-10 w-full" />
                  ) : null}

                  {installations?.length === 0 ? (
                     <p className="text-muted-foreground text-sm">
                        No installations were found for this GitHub account. Install the GitHub App
                        on the repositories you want to read.
                     </p>
                  ) : null}

                  {installations && installations.length > 0 ? (
                     <ul className="flex flex-col gap-2">
                        {installations.map((installation) => {
                           const isSelected = installation.id === status.installationId;
                           return (
                              <li key={installation.id}>
                                 <Button
                                    type="button"
                                    variant={isSelected ? 'default' : 'outline'}
                                    className="w-full justify-between"
                                    onClick={() => void onChooseInstallation(installation.id)}
                                    disabled={busy !== null || isSelected}
                                 >
                                    <span>
                                       {installation.accountLogin} ({installation.accountType})
                                    </span>
                                    <span className="text-xs">
                                       {isSelected ? 'Selected' : `Installation ${installation.id}`}
                                    </span>
                                 </Button>
                              </li>
                           );
                        })}
                     </ul>
                  ) : null}

                  {installUrl ? (
                     <Button variant="ghost" size="sm" asChild className="self-start">
                        <a href={installUrl} target="_blank" rel="noopener noreferrer">
                           Install the GitHub App
                        </a>
                     </Button>
                  ) : null}
               </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
               {status.status === 'disconnected' || status.status === 'reauthorization_required' ? (
                  <Button type="button" onClick={() => void onConnect()} disabled={busy !== null}>
                     {busy === 'connect' ? 'Starting…' : 'Connect GitHub'}
                  </Button>
               ) : null}
               {connected ? (
                  <Button
                     type="button"
                     variant="outline"
                     onClick={() => void onDisconnect()}
                     disabled={busy !== null}
                  >
                     {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect GitHub'}
                  </Button>
               ) : null}
               {status.configured ? (
                  <Button variant="ghost" asChild>
                     <Link href={`/w/${workspaceId}/settings`}>Refresh settings</Link>
                  </Button>
               ) : null}
            </div>

            <p className="text-muted-foreground text-xs">
               Disconnecting revokes the stored authorization and hides pull-request details.
               Uninstalling the GitHub App from an account or repository is a separate action in
               GitHub.
            </p>
         </CardContent>
      </Card>
   );
}
