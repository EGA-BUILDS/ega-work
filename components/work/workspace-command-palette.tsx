'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
   Command,
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import type { WorkspaceSearchResults } from '@/lib/work/types';
import { issueIdentifier } from '@/lib/work/validation';

const EMPTY_RESULTS: WorkspaceSearchResults = { projects: [], issues: [] };

export function WorkspaceCommandPalette({ workspaceId }: { workspaceId: string }) {
   const router = useRouter();
   const [open, setOpen] = useState(false);
   const [query, setQuery] = useState('');
   const [results, setResults] = useState<WorkspaceSearchResults>(EMPTY_RESULTS);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      function onKeyDown(event: KeyboardEvent) {
         if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            setOpen((current) => !current);
         }
      }
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
   }, []);

   useEffect(() => {
      if (!open) {
         return;
      }
      const value = query.trim();
      if (!value) {
         setResults(EMPTY_RESULTS);
         setLoading(false);
         setError(null);
         return;
      }

      const controller = new AbortController();
      const timer = window.setTimeout(async () => {
         setLoading(true);
         setError(null);
         try {
            const response = await fetch(
               `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(value)}`,
               { signal: controller.signal }
            );
            const payload = (await response.json().catch(() => null)) as
               | (WorkspaceSearchResults & { error?: string })
               | null;
            if (!response.ok || !payload) {
               setError('Search is unavailable right now. Try again.');
               setResults(EMPTY_RESULTS);
               return;
            }
            setResults({ projects: payload.projects ?? [], issues: payload.issues ?? [] });
         } catch (fetchError) {
            if ((fetchError as Error).name !== 'AbortError') {
               setError('Search is unavailable right now. Try again.');
               setResults(EMPTY_RESULTS);
            }
         } finally {
            setLoading(false);
         }
      }, 250);

      return () => {
         controller.abort();
         window.clearTimeout(timer);
      };
   }, [open, query, workspaceId]);

   function choose(path: string) {
      setOpen(false);
      setQuery('');
      setResults(EMPTY_RESULTS);
      router.push(path);
   }

   const hasResults = results.projects.length > 0 || results.issues.length > 0;

   return (
      <>
         <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="gap-2"
            aria-label="Search projects and issues"
         >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="text-muted-foreground hidden rounded border px-1 font-mono text-[10px] sm:inline">
               ⌘K
            </kbd>
         </Button>
         <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Search workspace"
            description="Find saved projects and issues in this workspace."
         >
            <Command shouldFilter={false}>
               <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search projects or issues (try W-1)…"
               />
               <CommandList>
                  {error ? (
                     <div className="text-destructive px-3 py-6 text-center text-sm">{error}</div>
                  ) : loading && !hasResults ? (
                     <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                        Searching…
                     </div>
                  ) : (
                     <>
                        <CommandEmpty>
                           {query.trim()
                              ? 'No saved projects or issues match.'
                              : 'Type a project name, issue title, or identifier such as W-1.'}
                        </CommandEmpty>
                        {results.projects.length > 0 ? (
                           <CommandGroup heading="Projects">
                              {results.projects.map((project) => (
                                 <CommandItem
                                    key={project.id}
                                    value={`project-${project.id}`}
                                    onSelect={() =>
                                       choose(`/w/${workspaceId}/projects/${project.id}`)
                                    }
                                 >
                                    <FolderKanban className="size-4" />
                                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                                    <Badge variant="outline">Project</Badge>
                                 </CommandItem>
                              ))}
                           </CommandGroup>
                        ) : null}
                        {results.issues.length > 0 ? (
                           <CommandGroup heading="Issues">
                              {results.issues.map((issue) => (
                                 <CommandItem
                                    key={issue.id}
                                    value={`issue-${issue.id}`}
                                    onSelect={() => choose(`/w/${workspaceId}/issues/${issue.id}`)}
                                 >
                                    <span className="text-muted-foreground w-14 font-mono text-xs">
                                       {issueIdentifier(issue.number)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                                    <Badge
                                       variant={
                                          issue.status === 'completed' ? 'secondary' : 'outline'
                                       }
                                    >
                                       {issue.status === 'completed' ? 'Completed' : 'Open'}
                                    </Badge>
                                 </CommandItem>
                              ))}
                           </CommandGroup>
                        ) : null}
                     </>
                  )}
               </CommandList>
            </Command>
         </CommandDialog>
      </>
   );
}
