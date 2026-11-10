import type { WorkIssueStatus } from './types';

export const PROJECT_NAME_MAX = 200;
export const PROJECT_DESCRIPTION_MAX = 10000;
export const ISSUE_TITLE_MAX = 500;
export const ISSUE_DESCRIPTION_MAX = 20000;
export const ISSUE_STATUSES: readonly WorkIssueStatus[] = ['open', 'completed'];

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

type ProjectTextInput = { name?: unknown; description?: unknown };
type IssueTextInput = { title?: unknown; description?: unknown };

function optionalText(value: unknown, max: number): ValidationResult<string | null> {
   if (value === null || value === undefined) {
      return { ok: true, value: null };
   }
   if (typeof value !== 'string') {
      return { ok: false, error: 'Enter text only.' };
   }
   const trimmed = value.trim();
   if (!trimmed) {
      return { ok: true, value: null };
   }
   if (trimmed.length > max) {
      return { ok: false, error: `Keep this under ${max.toLocaleString('en')} characters.` };
   }
   return { ok: true, value: trimmed };
}

export function validateProjectInput(input: ProjectTextInput): ValidationResult<{
   name: string;
   description: string | null;
}> {
   if (typeof input.name !== 'string' || !input.name.trim()) {
      return { ok: false, error: 'Enter a project name.' };
   }
   const name = input.name.trim();
   if (name.length > PROJECT_NAME_MAX) {
      return { ok: false, error: `Keep the project name under ${PROJECT_NAME_MAX} characters.` };
   }
   const description = optionalText(input.description, PROJECT_DESCRIPTION_MAX);
   if (!description.ok) {
      return description;
   }
   return { ok: true, value: { name, description: description.value } };
}

export function validateIssueInput(input: IssueTextInput): ValidationResult<{
   title: string;
   description: string | null;
}> {
   if (typeof input.title !== 'string' || !input.title.trim()) {
      return { ok: false, error: 'Enter an issue title.' };
   }
   const title = input.title.trim();
   if (title.length > ISSUE_TITLE_MAX) {
      return { ok: false, error: `Keep the issue title under ${ISSUE_TITLE_MAX} characters.` };
   }
   const description = optionalText(input.description, ISSUE_DESCRIPTION_MAX);
   if (!description.ok) {
      return description;
   }
   return { ok: true, value: { title, description: description.value } };
}

export function isIssueStatus(value: unknown): value is WorkIssueStatus {
   return typeof value === 'string' && ISSUE_STATUSES.includes(value as WorkIssueStatus);
}

export function parseVersion(value: unknown): number | null {
   if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
      return null;
   }
   return value;
}

export function issueIdentifier(number: number): string {
   return `W-${number}`;
}
