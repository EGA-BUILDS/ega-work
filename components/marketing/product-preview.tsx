import {
   Box,
   FolderKanban,
   GitPullRequestArrow,
   Home,
   Inbox,
   Search,
   Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
   { label: 'Home', icon: Home, active: true },
   { label: 'My issues', icon: FolderKanban, active: false },
   { label: 'Reviews', icon: GitPullRequestArrow, active: false },
   { label: 'Inbox', icon: Inbox, active: false },
];

const WORKSPACE_ITEMS = [
   { label: 'Projects', icon: Box },
   { label: 'Teams', icon: Users },
];

const PROJECTS = [
   { name: 'Core workspace', detail: '12 issues · On track', progress: 68 },
   { name: 'Review queue', detail: '9 issues · On track', progress: 81 },
   { name: 'Release notes', detail: '7 issues · At risk', progress: 42 },
];

const ISSUES = [
   { id: 'WRK-128', title: 'Clarify issue completion rules', status: 'In progress' },
   { id: 'WRK-124', title: 'Show freshness on pull request observations', status: 'In review' },
   { id: 'WRK-119', title: 'Keep project health visible in the overview', status: 'Todo' },
   { id: 'WRK-116', title: 'Search issues by project and label', status: 'Todo' },
];

const PULL_REQUESTS = [
   { title: 'Keep PR state and issue status independent', repo: 'ega-work', number: 42 },
   { title: 'Add project progress to the work overview', repo: 'ega-work', number: 38 },
];

export function ProductPreview() {
   return (
      <figure className="relative">
         <div
            aria-hidden="true"
            className="absolute inset-x-10 -top-8 h-32 rounded-full bg-teal-500/10 blur-3xl"
         />

         <div
            aria-hidden="true"
            className="relative overflow-hidden rounded-xl border border-border/70 bg-container shadow-2xl shadow-black/40"
         >
            <div className="flex h-9 items-center gap-2 border-b border-border/60 bg-muted/30 px-3">
               <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-400/60" />
                  <span className="size-2 rounded-full bg-amber-400/60" />
                  <span className="size-2 rounded-full bg-emerald-400/60" />
               </div>
               <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center gap-1.5 rounded-md border border-border/50 bg-background/60 px-2 text-[10px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-teal-400/80" />
                  EGA Work / demo
               </div>
            </div>

            <div className="grid md:grid-cols-[190px_1fr]">
               <aside className="hidden flex-col border-r border-border/60 bg-sidebar/40 p-3 md:flex">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold">
                     <span className="flex size-5 items-center justify-center rounded bg-teal-600 text-[10px] text-white dark:bg-teal-500 dark:text-teal-950">
                        ✓
                     </span>
                     EGA Work
                  </div>

                  <div className="mt-4 space-y-0.5">
                     {SIDEBAR_ITEMS.map((item) => (
                        <div
                           key={item.label}
                           className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]',
                              item.active
                                 ? 'bg-accent text-foreground'
                                 : 'text-muted-foreground'
                           )}
                        >
                           <item.icon className="size-3.5" />
                           {item.label}
                        </div>
                     ))}
                  </div>

                  <p className="px-2 pb-1 pt-4 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
                     Workspace
                  </p>
                  <div className="space-y-0.5">
                     {WORKSPACE_ITEMS.map((item) => (
                        <div
                           key={item.label}
                           className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground"
                        >
                           <item.icon className="size-3.5" />
                           {item.label}
                        </div>
                     ))}
                  </div>

                  <div className="mt-auto flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                     <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                        AM
                     </span>
                     <div className="min-w-0">
                        <p className="truncate text-[10px] font-medium">Alex Morgan</p>
                        <p className="truncate text-[9px] text-muted-foreground">Demo workspace</p>
                     </div>
                  </div>
               </aside>

               <div className="min-w-0 p-3 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                     <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                           Workspace
                        </p>
                        <h3 className="mt-1 text-base font-semibold tracking-tight">Work overview</h3>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                           Projects, issues, and pull request observations.
                        </p>
                     </div>
                     <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Demo data
                     </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                     <span>
                        <span className="text-xs font-medium text-foreground">3</span> active
                        projects
                     </span>
                     <span>
                        <span className="text-xs font-medium text-foreground">18</span> active issues
                     </span>
                     <span>
                        <span className="text-xs font-medium text-foreground">2</span> open PRs
                     </span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                     <section>
                        <div className="mb-1.5 flex items-center justify-between">
                           <h4 className="text-[11px] font-medium">Active projects</h4>
                           <span className="text-[9px] text-muted-foreground">View all</span>
                        </div>
                        <div className="divide-y divide-border/50 overflow-hidden rounded-md border border-border/60">
                           {PROJECTS.map((project) => (
                              <div key={project.name} className="px-2.5 py-2">
                                 <div className="flex items-center gap-2">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted/60">
                                       <Box className="size-3 text-muted-foreground" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                       <p className="truncate text-[11px] font-medium">
                                          {project.name}
                                       </p>
                                       <p className="truncate text-[9px] text-muted-foreground">
                                          {project.detail}
                                       </p>
                                    </div>
                                    <span className="text-[9px] tabular-nums text-muted-foreground">
                                       {project.progress}%
                                    </span>
                                 </div>
                                 <Progress
                                    value={project.progress}
                                    className="mt-1.5 h-0.5"
                                 />
                              </div>
                           ))}
                        </div>
                     </section>

                     <section>
                        <div className="mb-1.5 flex items-center justify-between">
                           <h4 className="text-[11px] font-medium">Issues</h4>
                           <span className="text-[9px] text-muted-foreground">18 active</span>
                        </div>
                        <div className="overflow-hidden rounded-md border border-border/60">
                           <div className="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5 text-[9px] text-muted-foreground">
                              <Search className="size-3" />
                              Search issues
                           </div>
                           <ul className="divide-y divide-border/50">
                              {ISSUES.map((issue) => (
                                 <li
                                    key={issue.id}
                                    className="flex items-center gap-2 px-2.5 py-1.5"
                                 >
                                    <span className="size-1.5 shrink-0 rounded-full bg-amber-400/80" />
                                    <span className="w-12 shrink-0 font-mono text-[9px] text-muted-foreground">
                                       {issue.id}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[11px]">
                                       {issue.title}
                                    </span>
                                    <span className="hidden text-[9px] text-muted-foreground sm:inline">
                                       {issue.status}
                                    </span>
                                 </li>
                              ))}
                           </ul>
                        </div>
                     </section>
                  </div>

                  <section className="mt-3">
                     <div className="mb-1.5 flex items-center justify-between">
                        <h4 className="text-[11px] font-medium">Pull request observations</h4>
                        <span className="text-[9px] text-muted-foreground">Demo only</span>
                     </div>
                     <div className="overflow-hidden rounded-md border border-border/60">
                        <ul className="divide-y divide-border/50">
                           {PULL_REQUESTS.map((pullRequest) => (
                              <li
                                 key={pullRequest.number}
                                 className="flex items-center gap-2 px-2.5 py-1.5"
                              >
                                 <GitPullRequestArrow className="size-3.5 shrink-0 text-emerald-400/80" />
                                 <span className="min-w-0 flex-1 truncate text-[11px]">
                                    {pullRequest.title}
                                 </span>
                                 <span className="hidden shrink-0 text-[9px] text-muted-foreground sm:inline">
                                    {pullRequest.repo} #{pullRequest.number}
                                 </span>
                                 <Badge
                                    variant="outline"
                                    className="shrink-0 border-emerald-500/30 px-1.5 py-0 text-[9px] text-emerald-400"
                                 >
                                    Open
                                 </Badge>
                              </li>
                           ))}
                        </ul>
                     </div>
                  </section>
               </div>
            </div>
         </div>

         <figcaption className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-foreground">Product preview</span>
            <span>
               Sample workspace data. Nothing is saved, and no live GitHub connection is active.
            </span>
         </figcaption>
      </figure>
   );
}
