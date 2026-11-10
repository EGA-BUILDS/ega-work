'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function IssueCreateForm({
   workspaceId,
   projectId,
}: {
   workspaceId: string;
   projectId: string;
}) {
   const router = useRouter();
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (saving) return;
      setError(null);
      setSaving(true);

      try {
         const response = await fetch(
            `/api/workspaces/${workspaceId}/projects/${projectId}/issues`,
            {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ title, description }),
            }
         );
         const payload = (await response.json().catch(() => null)) as { error?: string } | null;

         if (!response.ok) {
            setError(payload?.error ?? 'The issue was not saved. Try again.');
            return;
         }

         setTitle('');
         setDescription('');
         router.refresh();
      } catch {
         setError('The issue was not saved. Check your connection and try again.');
      } finally {
         setSaving(false);
      }
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Create an issue</CardTitle>
            <CardDescription>
               New issues start open and are assigned to you in this private workspace.
            </CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
               <div className="grid gap-2">
                  <Label htmlFor="issue-title">Title</Label>
                  <Input
                     id="issue-title"
                     value={title}
                     onChange={(event) => setTitle(event.target.value)}
                     maxLength={500}
                     required
                     disabled={saving}
                     placeholder="Fix the sign-in redirect"
                  />
               </div>
               <div className="grid gap-2">
                  <Label htmlFor="issue-description">Description</Label>
                  <Textarea
                     id="issue-description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                     maxLength={20000}
                     rows={3}
                     disabled={saving}
                     placeholder="Optional details"
                  />
               </div>
               <div aria-live="polite">
                  {error ? (
                     <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                     </Alert>
                  ) : null}
               </div>
               <Button type="submit" disabled={saving || !title.trim()} className="self-start">
                  {saving ? 'Saving…' : 'Create issue'}
               </Button>
            </form>
         </CardContent>
      </Card>
   );
}
