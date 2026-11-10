import { Issue, issues } from '@/mock-data/issues';
import { Project, projects } from '@/mock-data/projects';
import { Review, reviews } from '@/mock-data/reviews';
import { StatusCategory } from '@/mock-data/status';

/** Workspace used by the existing nested routes (app/[orgId]/...). */
export const DEFAULT_ORG_ID = 'lndev-ui';

export const DEMO_PR_NOTE =
   'Demo observations from fixtures — GitHub sync is not connected. PR state is independent of issue status; a merged PR never completes an issue automatically.';

/* -------------------------------------------------------------------------- */
/*                              Issue filters                                 */
/* -------------------------------------------------------------------------- */

export type StatusFilter = 'all' | 'active' | 'backlog' | 'completed' | 'canceled';

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
   { value: 'all', label: 'All statuses' },
   { value: 'active', label: 'Active' },
   { value: 'backlog', label: 'Backlog' },
   { value: 'completed', label: 'Completed' },
   { value: 'canceled', label: 'Canceled' },
];

const STATUS_FILTER_CATEGORIES: Record<StatusFilter, StatusCategory[] | null> = {
   all: null,
   active: ['started', 'unstarted', 'triage'],
   backlog: ['backlog'],
   completed: ['completed'],
   canceled: ['canceled'],
};

export function isStatusFilter(value: string): value is StatusFilter {
   return STATUS_FILTERS.some((option) => option.value === value);
}

export interface ProjectOption {
   id: string;
   name: string;
}

const projectOptionMap = new Map<string, ProjectOption>();
for (const issue of issues) {
   const project = issue.project;
   if (project && !projectOptionMap.has(project.id)) {
      projectOptionMap.set(project.id, { id: project.id, name: project.name });
   }
}

export const issueProjectOptions: ProjectOption[] = Array.from(projectOptionMap.values()).sort(
   (a, b) => a.name.localeCompare(b.name)
);

export interface IssueFilter {
   query: string;
   status: StatusFilter;
   projectId: string;
}

export function filterIssues(allIssues: Issue[], filter: IssueFilter): Issue[] {
   const query = filter.query.trim().toLowerCase();
   const categories = STATUS_FILTER_CATEGORIES[filter.status];

   return allIssues.filter((issue) => {
      if (categories !== null && !categories.includes(issue.status.category)) {
         return false;
      }
      if (filter.projectId !== 'all' && issue.project?.id !== filter.projectId) {
         return false;
      }
      if (query === '') {
         return true;
      }

      const searchable = [
         issue.identifier,
         issue.title,
         issue.status.name,
         issue.priority.name,
         issue.project?.name ?? '',
         issue.assignee?.name ?? '',
         ...issue.labels.map((label) => label.name),
      ]
         .join(' ')
         .toLowerCase();

      return searchable.includes(query);
   });
}

/* -------------------------------------------------------------------------- */
/*                              Issue sorting                                 */
/* -------------------------------------------------------------------------- */

export type IssueSort = 'priority' | 'newest' | 'oldest' | 'identifier';

export const ISSUE_SORTS: { value: IssueSort; label: string }[] = [
   { value: 'priority', label: 'Priority' },
   { value: 'newest', label: 'Newest' },
   { value: 'oldest', label: 'Oldest' },
   { value: 'identifier', label: 'Identifier' },
];

const PRIORITY_ORDER: Record<string, number | undefined> = {
   urgent: 0,
   high: 1,
   medium: 2,
   low: 3,
   'no-priority': 4,
};

export function isIssueSort(value: string): value is IssueSort {
   return ISSUE_SORTS.some((option) => option.value === value);
}

export function sortIssues(allIssues: Issue[], sort: IssueSort): Issue[] {
   return allIssues.slice().sort((a, b) => {
      switch (sort) {
         case 'newest':
            return b.createdAt.localeCompare(a.createdAt);
         case 'oldest':
            return a.createdAt.localeCompare(b.createdAt);
         case 'identifier':
            return a.identifier.localeCompare(b.identifier);
         case 'priority':
            return (
               (PRIORITY_ORDER[a.priority.id] ?? 99) -
                  (PRIORITY_ORDER[b.priority.id] ?? 99) || b.createdAt.localeCompare(a.createdAt)
            );
         default: {
            const _exhaustive: never = sort;
            return _exhaustive;
         }
      }
   });
}

/* -------------------------------------------------------------------------- */
/*                            Project summaries                               */
/* -------------------------------------------------------------------------- */

const ACTIVE_STATUS_CATEGORIES = new Set<StatusCategory>(['started', 'unstarted', 'triage']);
const CLOSED_STATUS_CATEGORIES = new Set<StatusCategory>(['completed', 'canceled']);

export interface ProjectSummary {
   project: Project;
   issueCount: number;
   activeIssueCount: number;
}

export const projectSummaries: ProjectSummary[] = projects
   .map((project) => {
      const projectIssues = issues.filter((issue) => issue.project?.id === project.id);
      return {
         project,
         issueCount: projectIssues.length,
         activeIssueCount: projectIssues.filter((issue) =>
            ACTIVE_STATUS_CATEGORIES.has(issue.status.category)
         ).length,
      };
   })
   .filter((summary) => !CLOSED_STATUS_CATEGORIES.has(summary.project.status.category))
   .sort(
      (a, b) =>
         b.project.percentComplete - a.project.percentComplete ||
         a.project.name.localeCompare(b.project.name)
   );

export const activeProjectCount = projects.filter(
   (project) => !CLOSED_STATUS_CATEGORIES.has(project.status.category)
).length;

export const activeIssueCount = issues.filter((issue) =>
   ACTIVE_STATUS_CATEGORIES.has(issue.status.category)
).length;

export const openPrCount = reviews.filter((review) => review.status === 'open').length;

/* -------------------------------------------------------------------------- */
/*                          PR observations                                   */
/* -------------------------------------------------------------------------- */

export interface FreshnessInfo {
   label: string;
   dotClass: string;
   textClass: string;
}

const MINUTES_PER_UNIT: Record<string, number | undefined> = {
   m: 1,
   h: 60,
   d: 60 * 24,
   w: 60 * 24 * 7,
};

/** Parses fixture freshness labels ("30m", "6h", "2d", "1w") into minutes. */
export function parseTimeAgo(value: string): number {
   const match = /^(\d+)\s*(m|h|d|w)$/.exec(value.trim());
   if (!match) {
      return Number.POSITIVE_INFINITY;
   }

   const amount = Number(match[1]);
   const multiplier = MINUTES_PER_UNIT[match[2]];
   if (multiplier === undefined) {
      return Number.POSITIVE_INFINITY;
   }

   return amount * multiplier;
}

export function getFreshness(timeAgo: string): FreshnessInfo {
   const minutes = parseTimeAgo(timeAgo);

   if (minutes < 2 * 60) {
      return {
         label: 'Fresh',
         dotClass: 'bg-emerald-500',
         textClass: 'text-emerald-600 dark:text-emerald-400',
      };
   }
   if (minutes < 24 * 60) {
      return {
         label: 'Today',
         dotClass: 'bg-teal-500',
         textClass: 'text-teal-600 dark:text-teal-400',
      };
   }
   if (minutes < 7 * 24 * 60) {
      return {
         label: 'This week',
         dotClass: 'bg-amber-500',
         textClass: 'text-amber-600 dark:text-amber-400',
      };
   }

   return {
      label: 'Older',
      dotClass: 'bg-muted-foreground',
      textClass: 'text-muted-foreground',
   };
}

export interface PrObservation {
   review: Review;
   freshness: FreshnessInfo;
   linkedIssue: Issue | undefined;
}

/** Most recently observed "For you" pull requests, with the issues they resolve. */
export const prObservations: PrObservation[] = reviews
   .filter((review) => review.list === 'for-you')
   .map((review) => ({
      review,
      freshness: getFreshness(review.timeAgo),
      linkedIssue: issues.find((issue) => issue.identifier === review.resolves.identifier),
   }))
   .sort((a, b) => parseTimeAgo(a.review.timeAgo) - parseTimeAgo(b.review.timeAgo))
   .slice(0, 5);
