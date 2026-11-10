'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ProjectCreateForm({ workspaceId }: { workspaceId: string }) {
   const router = useRouter();
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (saving) return;
      setError(null);
      setSaving(true);

      try {
         const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
         });
         const payload = (await response.json().catch(() => null)) as { error?: string } | null;

         if (!response.ok) {
            setError(payload?.error ?? 'The project was not saved. Try again.');
            return;
         }

         setName('');
         setDescription('');
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
            <CardTitle>Create a project</CardTitle>
            <CardDescription>Saved to this private workspace.</CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
               <div className="grid gap-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                     id="project-name"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                     maxLength={200}
                     required
                     disabled={saving}
                     placeholder="Website launch"
                  />
               </div>
               <div className="grid gap-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                     id="project-description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                     maxLength={10000}
                     disabled={saving}
                     placeholder="Optional context for this project"
                     rows={3}
                  />
               </div>
               <div aria-live="polite">
                  {error ? (
                     <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                     </Alert>
                  ) : null}
               </div>
               <Button type="submit" disabled={saving || !name.trim()} className="self-start">
                  {saving ? 'Saving…' : 'Create project'}
               </Button>
            </form>
         </CardContent>
      </Card>
   );
}
