'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkIssue } from '@/lib/work/types';
import { issueIdentifier } from '@/lib/work/validation';

export function IssueDetail({
   workspaceId,
   projectName,
   issue,
}: {
   workspaceId: string;
   projectName: string;
   issue: WorkIssue;
}) {
   const router = useRouter();
   const [title, setTitle] = useState(issue.title);
   const [description, setDescription] = useState(issue.description ?? '');
   const [version, setVersion] = useState(issue.version);
   const [status, setStatus] = useState(issue.status);
   const [error, setError] = useState<string | null>(null);
   const [saved, setSaved] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   async function patch(body: Record<string, unknown>, successMessage: string) {
      setError(null);
      setSaved(null);
      setSaving(true);
      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/issues/${issue.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, version }),
         });
         const payload = (await response.json().catch(() => null)) as {
            issue?: WorkIssue;
            error?: string;
         } | null;

         if (!response.ok || !payload?.issue) {
            setError(
               payload?.error ??
                  'The issue was not saved. Reload the page and check the current values.'
            );
            return;
         }

         setTitle(payload.issue.title);
         setDescription(payload.issue.description ?? '');
         setStatus(payload.issue.status);
         setVersion(payload.issue.version);
         setSaved(successMessage);
         router.refresh();
      } catch {
         setError('The issue was not saved. Check your connection and try again.');
      } finally {
         setSaving(false);
      }
   }

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (saving) return;
      await patch({ title, description }, 'Issue saved.');
   }

   async function onToggleStatus() {
      if (saving) return;
      await patch(
         { status: status === 'open' ? 'completed' : 'open' },
         status === 'open' ? 'Issue completed.' : 'Issue reopened.'
      );
   }

   return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
         <div>
            <p className="text-muted-foreground text-sm">{projectName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
               <span className="text-muted-foreground font-mono text-sm">
                  {issueIdentifier(issue.number)}
               </span>
               <Badge variant={status === 'completed' ? 'secondary' : 'outline'}>
                  {status === 'completed' ? 'Completed' : 'Open'}
               </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Issue details</CardTitle>
               <CardDescription>
                  Saved changes persist after reload. Completion is controlled here, not by a pull
                  request.
               </CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={onSubmit} className="flex flex-col gap-4">
                  <div className="grid gap-2">
                     <Label htmlFor="edit-issue-title">Title</Label>
                     <Input
                        id="edit-issue-title"
                        value={title}
                        onChange={(event) => {
                           setTitle(event.target.value);
                           setSaved(null);
                        }}
                        maxLength={500}
                        required
                        disabled={saving}
                     />
                  </div>
                  <div className="grid gap-2">
                     <Label htmlFor="edit-issue-description">Description</Label>
                     <Textarea
                        id="edit-issue-description"
                        value={description}
                        onChange={(event) => {
                           setDescription(event.target.value);
                           setSaved(null);
                        }}
                        maxLength={20000}
                        rows={6}
                        disabled={saving}
                     />
                  </div>
                  <div aria-live="polite">
                     {error ? (
                        <Alert variant="destructive">
                           <AlertDescription>{error}</AlertDescription>
                        </Alert>
                     ) : null}
                     {saved ? (
                        <Alert>
                           <AlertDescription>{saved}</AlertDescription>
                        </Alert>
                     ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                     <Button type="submit" disabled={saving || !title.trim()}>
                        {saving ? 'Saving…' : 'Save issue'}
                     </Button>
                     <Button
                        type="button"
                        variant="outline"
                        onClick={onToggleStatus}
                        disabled={saving}
                     >
                        {status === 'open' ? 'Complete issue' : 'Reopen issue'}
                     </Button>
                  </div>
               </form>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Pull request</CardTitle>
               <CardDescription>
                  GitHub linking is not available in this workspace yet. Completing or reopening
                  this issue never depends on a pull request.
               </CardDescription>
            </CardHeader>
         </Card>
      </div>
   );
}
