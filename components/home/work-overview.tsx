'use client';

import { DiffStat, PrIcon } from '@/components/common/reviews/review-shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { Issue, issues } from '@/mock-data/issues';
import { Review } from '@/mock-data/reviews';
import { User } from '@/mock-data/users';
import { format } from 'date-fns';
import { ArrowRight, CircleUserRound, Info, Search, SearchX, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
   DEFAULT_ORG_ID,
   DEMO_PR_NOTE,
   ISSUE_SORTS,
   STATUS_FILTERS,
   activeIssueCount,
   activeProjectCount,
   filterIssues,
   isIssueSort,
   isStatusFilter,
   issueProjectOptions,
   openPrCount,
   prObservations,
   projectSummaries,
   sortIssues,
   type IssueSort,
   type PrObservation,
   type ProjectSummary,
   type StatusFilter,
} from './demo-data';

export interface WorkOverviewProps {
   /** Defaults to the route's orgId, then the demo workspace. */
   orgId?: string;
}

/**
 * Current-work overview for the Work home dashboard.
 *
 * Everything rendered here comes from the repository fixtures. The component
 * only links to existing routes; it never writes, refreshes or "saves".
 */
export function WorkOverview({ orgId: orgIdProp }: WorkOverviewProps = {}) {
   const params = useParams<{ orgId: string }>();
   const orgId = orgIdProp ?? params.orgId ?? DEFAULT_ORG_ID;

   return (
      <div className="w-full space-y-5 px-1 pb-6">
         <SummaryStats />
         <ProjectsSection orgId={orgId} />
         <IssuesSection orgId={orgId} />
         <PrObservationsSection orgId={orgId} />
      </div>
   );
}

export default WorkOverview;

/* -------------------------------------------------------------------------- */
/*                                 Chrome                                     */
/* -------------------------------------------------------------------------- */

function SummaryStats() {
   const stats: { value: number; label: string }[] = [
      { value: activeProjectCount, label: 'active projects' },
      { value: activeIssueCount, label: 'active issues' },
      { value: openPrCount, label: 'open PRs' },
   ];

   return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
         {stats.map((stat) => (
            <span key={stat.label} className="flex items-baseline gap-1">
               <span className="text-sm font-medium text-foreground">{stat.value}</span>
               {stat.label}
            </span>
         ))}
         <span className="ml-auto text-muted-foreground/70">Demo data</span>
      </div>
   );
}

interface SectionHeaderProps {
   id?: string;
   title: string;
   count?: number;
   viewAllHref?: string;
   viewAllLabel?: string;
}

function SectionHeader({ id, title, count, viewAllHref, viewAllLabel }: SectionHeaderProps) {
   return (
      <div className="flex items-center justify-between gap-2">
         <h2 id={id} className="flex items-baseline gap-2 text-sm font-medium">
            {title}
            {count !== undefined && (
               <span className="text-xs font-normal text-muted-foreground">{count}</span>
            )}
         </h2>
         {viewAllHref && (
            <Link
               href={viewAllHref}
               className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
               {viewAllLabel ?? 'View all'}
               <ArrowRight className="size-3" />
            </Link>
         )}
      </div>
   );
}

/* -------------------------------------------------------------------------- */
/*                              Project summaries                             */
/* -------------------------------------------------------------------------- */

function ProjectsSection({ orgId }: { orgId: string }) {
   return (
      <section aria-labelledby="home-projects-heading" className="min-w-0 space-y-2">
         <SectionHeader
            id="home-projects-heading"
            title="Active projects"
            count={projectSummaries.length}
            viewAllHref={`/${orgId}/projects`}
            viewAllLabel="All projects"
         />
         <div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/60 lg:grid-cols-2">
            {projectSummaries.map((summary) => (
               <ProjectRow key={summary.project.id} summary={summary} orgId={orgId} />
            ))}
         </div>
      </section>
   );
}

function ProjectRow({ summary, orgId }: { summary: ProjectSummary; orgId: string }) {
   const { project, issueCount, activeIssueCount } = summary;
   const targetDate = project.targetDate ? new Date(project.targetDate) : undefined;

   return (
      <Link
         href={`/${orgId}/project/${project.id}/overview`}
         className="flex items-center gap-3 bg-container px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none sm:px-4"
      >
         <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
            <project.icon className="size-4 text-muted-foreground" />
         </span>
         <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
               <span className="min-w-0 truncate text-sm font-medium">{project.name}</span>
               <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                  {project.status.name}
               </span>
               <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground md:inline-flex">
                  <span
                     className="size-1.5 rounded-full"
                     style={{ backgroundColor: project.health.color }}
                     aria-hidden="true"
                  />
                  {project.health.name}
               </span>
            </span>
            <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
               <Progress
                  value={project.percentComplete}
                  aria-hidden="true"
                  className="h-1 w-20 sm:w-24"
               />
               <span className="shrink-0">{project.percentComplete}%</span>
               <span className="hidden shrink-0 md:inline">{issueCount} issues</span>
               <span className="hidden shrink-0 lg:inline">{activeIssueCount} active</span>
            </span>
         </span>
         <span className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
               <Initials user={project.lead} />
               <span className="hidden lg:inline">{project.lead.name}</span>
            </span>
            {targetDate && <span className="w-14 text-right">{format(targetDate, 'MMM d')}</span>}
         </span>
      </Link>
   );
}

/* -------------------------------------------------------------------------- */
/*                                  Issues                                    */
/* -------------------------------------------------------------------------- */

function IssuesSection({ orgId }: { orgId: string }) {
   const [query, setQuery] = useState('');
   const [status, setStatus] = useState<StatusFilter>('active');
   const [projectId, setProjectId] = useState('all');
   const [sort, setSort] = useState<IssueSort>('priority');

   const filteredIssues = useMemo(
      () => sortIssues(filterIssues(issues, { query, status, projectId }), sort),
      [query, status, projectId, sort]
   );

   const hasActiveFilters = query.trim() !== '' || status !== 'active' || projectId !== 'all';

   const resetFilters = () => {
      setQuery('');
      setStatus('active');
      setProjectId('all');
   };

   return (
      <section aria-labelledby="home-issues-heading" className="min-w-0 space-y-2">
         <SectionHeader
            id="home-issues-heading"
            title="Issues"
            count={filteredIssues.length}
            viewAllHref={`/${orgId}/team/CORE/all`}
            viewAllLabel="Team issues"
         />
         <div className="overflow-hidden rounded-md border border-border/70 bg-container">
            <div className="space-y-2 border-b border-border/60 p-3">
               <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                     value={query}
                     onChange={(event) => setQuery(event.target.value)}
                     placeholder="Search by title, ID, label or project"
                     aria-label="Search issues"
                     className="pl-8 pr-8"
                  />
                  {query !== '' && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                     >
                        <X className="size-3.5" />
                     </Button>
                  )}
               </div>

               <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                     value={status}
                     onValueChange={(value) => {
                        if (isStatusFilter(value)) {
                           setStatus(value);
                        }
                     }}
                  >
                     <SelectTrigger aria-label="Filter by status" className="h-8">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {STATUS_FILTERS.map((option) => (
                           <SelectItem key={option.value} value={option.value}>
                              {option.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>

                  <Select value={projectId} onValueChange={setProjectId}>
                     <SelectTrigger aria-label="Filter by project" className="h-8">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">All projects</SelectItem>
                        {issueProjectOptions.map((option) => (
                           <SelectItem key={option.id} value={option.id}>
                              {option.name}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>

                  <Select
                     value={sort}
                     onValueChange={(value) => {
                        if (isIssueSort(value)) {
                           setSort(value);
                        }
                     }}
                  >
                     <SelectTrigger aria-label="Sort issues" className="h-8">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {ISSUE_SORTS.map((option) => (
                           <SelectItem key={option.value} value={option.value}>
                              {option.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="flex items-center justify-between gap-2">
                  <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                     {filteredIssues.length} {filteredIssues.length === 1 ? 'issue' : 'issues'}
                  </p>
                  {hasActiveFilters && (
                     <Button variant="ghost" size="xs" onClick={resetFilters} className="h-7 text-xs">
                        Clear filters
                     </Button>
                  )}
               </div>
            </div>

            {filteredIssues.length > 0 ? (
               <ul className="max-h-[520px] divide-y divide-border/60 overflow-y-auto">
                  {filteredIssues.map((issue) => (
                     <IssueRow key={issue.id} issue={issue} orgId={orgId} />
                  ))}
               </ul>
            ) : (
               <NoResults onReset={resetFilters} />
            )}
         </div>
      </section>
   );
}

function IssueRow({ issue, orgId }: { issue: Issue; orgId: string }) {
   return (
      <li>
         <Link
            href={`/${orgId}/issue/${issue.identifier}`}
            className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none sm:gap-3 sm:px-4"
         >
            <span className="hidden w-16 shrink-0 font-mono text-xs text-muted-foreground md:inline">
               {issue.identifier}
            </span>
            <issue.priority.icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex w-24 shrink-0 items-center gap-1.5 sm:w-36">
               <span aria-hidden="true" className="flex shrink-0">
                  <issue.status.icon />
               </span>
               <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {issue.status.name}
               </span>
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
            {issue.project && (
               <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground lg:inline">
                  {issue.project.name}
               </span>
            )}
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
               {format(new Date(issue.createdAt), 'MMM d')}
            </span>
            <Initials user={issue.assignee} />
         </Link>
      </li>
   );
}

function NoResults({ onReset }: { onReset: () => void }) {
   return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
         <SearchX className="size-5 text-muted-foreground" />
         <p className="text-sm font-medium">No issues match these filters</p>
         <p className="text-xs text-muted-foreground">
            Try a different search term, or clear the filters to see active work.
         </p>
         <Button variant="outline" size="sm" onClick={onReset} className="mt-1">
            Clear filters
         </Button>
      </div>
   );
}

/* -------------------------------------------------------------------------- */
/*                            PR observations                                 */
/* -------------------------------------------------------------------------- */

const PR_STATUS_LABEL: Record<Review['status'], string> = {
   open: 'Open',
   merged: 'Merged',
   closed: 'Closed',
};

const PR_STATUS_CLASS: Record<Review['status'], string> = {
   open: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
   merged: 'border-violet-500/30 text-violet-700 dark:text-violet-400',
   closed: 'border-red-500/30 text-red-700 dark:text-red-400',
};

function PrObservationsSection({ orgId }: { orgId: string }) {
   return (
      <section aria-labelledby="home-prs-heading" className="min-w-0 space-y-2">
         <SectionHeader
            id="home-prs-heading"
            title="Pull request observations"
            count={prObservations.length}
            viewAllHref={`/${orgId}/reviews`}
            viewAllLabel="All reviews"
         />
         <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            {DEMO_PR_NOTE}
         </p>
         <div className="overflow-hidden rounded-md border border-border/70 bg-container">
            <ul className="divide-y divide-border/60">
               {prObservations.map((observation) => (
                  <PrRow key={observation.review.id} observation={observation} orgId={orgId} />
               ))}
            </ul>
         </div>
      </section>
   );
}

function PrRow({ observation, orgId }: { observation: PrObservation; orgId: string }) {
   const { review, freshness, linkedIssue } = observation;

   return (
      <li className="px-3 py-3 transition-colors hover:bg-accent/50 motion-reduce:transition-none sm:px-4">
         <div className="flex items-start gap-3">
            <Link
               href={`/${orgId}/review/${review.id}`}
               className="flex min-w-0 flex-1 items-start gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
               <PrIcon status={review.status} className="mt-0.5" />
               <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{review.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                     <span className="shrink-0">
                        {review.repo} #{review.prNumber}
                     </span>
                     <DiffStat additions={review.additions} deletions={review.deletions} />
                     <span className="inline-flex shrink-0 items-center gap-1.5">
                        <span
                           className={cn('size-1.5 rounded-full', freshness.dotClass)}
                           aria-hidden="true"
                        />
                        <span className={freshness.textClass}>{freshness.label}</span>
                     </span>
                     <span className="shrink-0">sample age: {review.timeAgo}</span>
                  </span>
               </span>
            </Link>
            <Badge
               variant="outline"
               className={cn('mt-0.5 shrink-0 font-medium', PR_STATUS_CLASS[review.status])}
            >
               {PR_STATUS_LABEL[review.status]}
            </Badge>
         </div>
         <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-7 text-xs text-muted-foreground">
            <span>Linked issue</span>
            {linkedIssue ? (
               <Link
                  href={`/${orgId}/issue/${linkedIssue.identifier}`}
                  className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
               >
                  {linkedIssue.identifier}
               </Link>
            ) : (
               <span className="font-medium text-foreground">{review.resolves.identifier}</span>
            )}
            {linkedIssue && (
               <span>
                  · Issue status: <span className="text-foreground">{linkedIssue.status.name}</span>
               </span>
            )}
         </div>
      </li>
   );
}

/* -------------------------------------------------------------------------- */
/*                                 Avatars                                    */
/* -------------------------------------------------------------------------- */

/** Initials-only avatar: no external image requests. */
function Initials({ user }: { user: User | null }) {
   if (!user) {
      return (
         <span
            role="img"
            aria-label="Unassigned"
            className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
         >
            <CircleUserRound className="size-4" />
         </span>
      );
   }

   const initials = user.name
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

   return (
      <Avatar className="size-6 shrink-0" title={user.name}>
         <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
            {initials}
         </AvatarFallback>
      </Avatar>
   );
}
