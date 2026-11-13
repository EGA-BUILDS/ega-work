import path from 'node:path';

/**
 * Runtime-only environment helpers for the authenticated gates (G2/G3).
 *
 * Validation happens when a test executes — never at config load — so
 * `--list` discovery always works. Nothing here logs secret values.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stored browser state for the dedicated E2E account. Gitignored; chmod 0600. */
export const AUTH_STATE_PATH = path.join('playwright', '.auth', 'user.json');

export type AccountEnv = {
   email: string;
   password: string;
   workspaceId: string;
};

export type CanaryEnv = {
   projectId: string;
   issueId: string;
   projectName: string | null;
   issueTitle: string | null;
};

function collectMissing(names: string[]): string[] {
   return names.filter((name) => {
      const value = process.env[name];
      return typeof value !== 'string' || value.trim() === '';
   });
}

function blockedError(missing: string[], purpose: string): Error {
   return new Error(
      `BLOCKED: ${purpose} cannot run. Missing environment variable(s): ${missing.join(', ')}.\n` +
         'Set them in the run environment only. Never commit them, log them, or paste them anywhere.\n' +
         'See docs/testing/ledger.md — runtime execution is BLOCKED until the owner provisions the disposable account and canary records.'
   );
}

export function loadAccountEnv(): AccountEnv {
   const required = ['E2E_EMAIL', 'E2E_PASSWORD', 'E2E_WORKSPACE_ID'] as const;
   const missing = collectMissing([...required]);
   if (missing.length > 0) {
      throw blockedError(missing, 'E2E authentication');
   }
   const workspaceId = process.env.E2E_WORKSPACE_ID!.trim();
   if (!UUID_PATTERN.test(workspaceId)) {
      throw new Error(
         'BLOCKED: E2E_WORKSPACE_ID is not a UUID. Refusing to authenticate against an unverified workspace.'
      );
   }
   return {
      email: process.env.E2E_EMAIL!.trim(),
      password: process.env.E2E_PASSWORD!,
      workspaceId: workspaceId.toLowerCase(),
   };
}

export function loadCanaryEnv(): CanaryEnv {
   const required = ['E2E_CANARY_PROJECT_ID', 'E2E_CANARY_ISSUE_ID'] as const;
   const missing = collectMissing([...required]);
   if (missing.length > 0) {
      throw blockedError(missing, 'Canary fixture read');
   }
   const projectId = process.env.E2E_CANARY_PROJECT_ID!.trim();
   const issueId = process.env.E2E_CANARY_ISSUE_ID!.trim();
   for (const [name, value] of [
      ['E2E_CANARY_PROJECT_ID', projectId],
      ['E2E_CANARY_ISSUE_ID', issueId],
   ] as const) {
      if (!UUID_PATTERN.test(value)) {
         throw new Error(`BLOCKED: ${name} is not a UUID. Refusing to use an unverified fixture.`);
      }
   }
   const optional = (name: string): string | null => {
      const value = process.env[name];
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
   };
   return {
      projectId: projectId.toLowerCase(),
      issueId: issueId.toLowerCase(),
      projectName: optional('E2E_CANARY_PROJECT_NAME'),
      issueTitle: optional('E2E_CANARY_ISSUE_TITLE'),
   };
}
