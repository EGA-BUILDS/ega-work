'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GithubIssueView, GithubPullRequestView } from '@/lib/work/github/types';

function stateBadge(state: GithubPullRequestView['state']) {
   switch (state) {
      case 'merged':
         return <Badge variant="secondary">Merged</Badge>;
      case 'closed':
         return <Badge variant="outline">Closed</Badge>;
      default:
         return <Badge>Open</Badge>;
   }
}

export function IssuePullRequest({
   workspaceId,
   issueId,
   initialView,
}: {
   workspaceId: string;
   issueId: string;
   initialView: GithubIssueView;
}) {
   const router = useRouter();
   const [pullRequest, setPullRequest] = useState(initialView.pullRequest);
   const [url, setUrl] = useState('');
   const [busy, setBusy] = useState<'link' | 'refresh' | 'unlink' | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(null);

   const basePath = `/api/workspaces/${workspaceId}/issues/${issueId}/pull-request`;

   async function readResponse(response: Response): Promise<{
      pullRequest?: GithubPullRequestView | null;
      error?: string;
   } | null> {
      return (await response.json().catch(() => null)) as {
         pullRequest?: GithubPullRequestView | null;
         error?: string;
      } | null;
   }

   async function onLink(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (busy) return;
      setBusy('link');
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(basePath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ url }),
         });
         const payload = await readResponse(response);
         if (!response.ok || !payload?.pullRequest) {
            setError(payload?.error ?? 'The pull request was not linked. Try again.');
            return;
         }
         setPullRequest(payload.pullRequest);
         setUrl('');
         setMessage('Pull request linked.');
         router.refresh();
      } catch {
         setError('The pull request was not linked. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   async function onRefresh() {
      if (busy) return;
      setBusy('refresh');
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(`${basePath}/refresh`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
         });
         const payload = await readResponse(response);
         if (!response.ok || !payload?.pullRequest) {
            setError(payload?.error ?? 'The pull request was not checked. Try again.');
            router.refresh();
            return;
         }
         setPullRequest(payload.pullRequest);
         setMessage('Pull request checked.');
      } catch {
         setError('The pull request was not checked. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   async function onUnlink() {
      if (busy) return;
      setBusy('unlink');
      setError(null);
      setMessage(null);
      try {
         const response = await fetch(basePath, {
            method: 'DELETE',
            headers: { Accept: 'application/json' },
         });
         const payload = await readResponse(response);
         if (!response.ok) {
            setError(payload?.error ?? 'The pull request was not unlinked. Try again.');
            return;
         }
         setPullRequest(null);
         setMessage('Pull request unlinked. The issue status is unchanged.');
         router.refresh();
      } catch {
         setError('The pull request was not unlinked. Check your connection and try again.');
      } finally {
         setBusy(null);
      }
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
               Pull request
               {pullRequest ? stateBadge(pullRequest.state) : null}
            </CardTitle>
            <CardDescription>
               GitHub owns the pull-request state. Completing or reopening this issue is always a
               separate action.
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

            {initialView.status === 'unconfigured' ? (
               <p className="text-muted-foreground text-sm">
                  GitHub is not configured in this environment, so pull requests cannot be linked or
                  checked. Issue completion still works normally.
               </p>
            ) : null}

            {initialView.status === 'unavailable' ? (
               <p className="text-muted-foreground text-sm">
                  GitHub state is temporarily unavailable. No stored pull-request details are shown.
                  Issue completion still works normally.
               </p>
            ) : null}

            {initialView.status === 'disconnected' ||
            initialView.status === 'reauthorization_required' ? (
               <p className="text-muted-foreground text-sm">
                  Connect GitHub in{' '}
                  <Link
                     href={`/w/${workspaceId}/settings`}
                     className="underline underline-offset-4"
                  >
                     workspace settings
                  </Link>{' '}
                  to link a pull request. Issue completion does not depend on GitHub.
               </p>
            ) : null}

            {initialView.status === 'connected' && pullRequest ? (
               <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                     <a
                        href={pullRequest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-4"
                     >
                        {pullRequest.title}
                     </a>
                     <span className="text-muted-foreground text-sm">
                        {pullRequest.owner}/{pullRequest.repository}#{pullRequest.number}
                     </span>
                  </div>

                  {pullRequest.error ? (
                     <Alert>
                        <AlertDescription>{pullRequest.error}</AlertDescription>
                     </Alert>
                  ) : null}

                  <p className="text-muted-foreground text-xs">
                     {pullRequest.lastCheckedLabel
                        ? `Last successful check: ${pullRequest.lastCheckedLabel}`
                        : 'Not checked yet.'}
                  </p>

                  <div className="flex flex-wrap gap-2">
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onRefresh()}
                        disabled={busy !== null}
                     >
                        {busy === 'refresh' ? 'Checking…' : 'Refresh'}
                     </Button>
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void onUnlink()}
                        disabled={busy !== null}
                     >
                        {busy === 'unlink' ? 'Unlinking…' : 'Unlink'}
                     </Button>
                  </div>
               </div>
            ) : null}

            {initialView.status === 'connected' && !pullRequest ? (
               <form onSubmit={onLink} className="flex flex-col gap-3">
                  <div className="grid gap-2">
                     <Label htmlFor="pull-request-url">GitHub pull request URL</Label>
                     <Input
                        id="pull-request-url"
                        name="pull-request-url"
                        value={url}
                        onChange={(event) => {
                           setUrl(event.target.value);
                           setMessage(null);
                        }}
                        placeholder="https://github.com/owner/repo/pull/123"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={busy !== null}
                        required
                     />
                  </div>
                  <p className="text-muted-foreground text-xs">
                     One pull request can be linked to this issue. The GitHub App installation must
                     be able to read the repository.
                  </p>
                  <Button
                     type="submit"
                     disabled={busy !== null || !url.trim()}
                     className="self-start"
                  >
                     {busy === 'link' ? 'Linking…' : 'Link pull request'}
                  </Button>
               </form>
            ) : null}
         </CardContent>
      </Card>
   );
}
