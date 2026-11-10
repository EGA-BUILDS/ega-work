'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkProject } from '@/lib/work/types';

export function ProjectEditForm({
   workspaceId,
   project,
}: {
   workspaceId: string;
   project: WorkProject;
}) {
   const router = useRouter();
   const [name, setName] = useState(project.name);
   const [description, setDescription] = useState(project.description ?? '');
   const [version, setVersion] = useState(project.version);
   const [error, setError] = useState<string | null>(null);
   const [saved, setSaved] = useState(false);
   const [saving, setSaving] = useState(false);

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (saving) return;
      setError(null);
      setSaved(false);
      setSaving(true);

      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, version }),
         });
         const payload = (await response.json().catch(() => null)) as {
            project?: WorkProject;
            error?: string;
         } | null;

         if (!response.ok || !payload?.project) {
            setError(
               payload?.error ??
                  'The project was not saved. Reload the page and check the current values.'
            );
            return;
         }

         setName(payload.project.name);
         setDescription(payload.project.description ?? '');
         setVersion(payload.project.version);
         setSaved(true);
         router.refresh();
      } catch {
         setError('The project was not saved. Check your connection and try again.');
      } finally {
         setSaving(false);
      }
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Project details</CardTitle>
            <CardDescription>Changes save to the database and appear after reload.</CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
               <div className="grid gap-2">
                  <Label htmlFor="edit-project-name">Name</Label>
                  <Input
                     id="edit-project-name"
                     value={name}
                     onChange={(event) => {
                        setName(event.target.value);
                        setSaved(false);
                     }}
                     maxLength={200}
                     required
                     disabled={saving}
                  />
               </div>
               <div className="grid gap-2">
                  <Label htmlFor="edit-project-description">Description</Label>
                  <Textarea
                     id="edit-project-description"
                     value={description}
                     onChange={(event) => {
                        setDescription(event.target.value);
                        setSaved(false);
                     }}
                     maxLength={10000}
                     rows={4}
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
                        <AlertDescription>Project saved.</AlertDescription>
                     </Alert>
                  ) : null}
               </div>
               <Button type="submit" disabled={saving || !name.trim()} className="self-start">
                  {saving ? 'Saving…' : 'Save project'}
               </Button>
            </form>
         </CardContent>
      </Card>
   );
}
