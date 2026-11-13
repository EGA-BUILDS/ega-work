import { UUID_PATTERN } from './account';

/**
 * Owner-only write gate for canary W01–W03 (issue #31).
 *
 * Everything is validated at test runtime — never at config load — so
 * `playwright test --list` works with no write-related env set. The agent
 * must never run write mode and never set these variables.
 */

export const WRITES_OPT_IN = 'I_ACCEPT_TEST_DATA';
export const INJECT_FAILURE_AFTER_WRITE = 'after-write';

export type WriteGateEnv = {
   workspaceId: string;
   accountUserId: string;
   canaryProjectId: string;
   canaryIssueId: string;
   confirmedOrigin: string;
   injectFailureAfterWrite: boolean;
};

function originOf(raw: string): string | null {
   try {
      const url = new URL(raw);
      if (url.username !== '' || url.password !== '') {
         return null;
      }
      return url.origin;
   } catch {
      return null;
   }
}

function blocked(message: string): Error {
   return new Error(`BLOCKED: ${message}`);
}

/**
 * Validate every precondition for a canary write. Returns the verified
 * identifiers or throws a named BLOCKED error before any mutation happens.
 */
export function loadWriteGate(baseURL: string | undefined): WriteGateEnv {
   const missing = [
      'E2E_ALLOW_WRITES',
      'E2E_CONFIRMED_ORIGIN',
      'E2E_WORKSPACE_ID',
      'E2E_ACCOUNT_USER_ID',
      'E2E_CANARY_PROJECT_ID',
      'E2E_CANARY_ISSUE_ID',
   ].filter((name) => typeof process.env[name] !== 'string' || process.env[name]!.trim() === '');
   if (missing.length > 0) {
      throw blocked(
         `canary write mode cannot run. Missing environment variable(s): ${missing.join(', ')}. ` +
            'Write mode is owner-only and dry-run by default: nothing runs until every value is set explicitly.'
      );
   }

   if (process.env.E2E_ALLOW_WRITES!.trim() !== WRITES_OPT_IN) {
      throw blocked(`E2E_ALLOW_WRITES must equal ${WRITES_OPT_IN}. Refusing to write.`);
   }

   const confirmedOrigin = originOf(process.env.E2E_CONFIRMED_ORIGIN!.trim());
   if (!confirmedOrigin) {
      throw blocked(
         'E2E_CONFIRMED_ORIGIN is not a valid http(s) origin (no path, query, or credentials).'
      );
   }
   const targetOrigin = baseURL ? originOf(baseURL) : null;
   if (!targetOrigin) {
      throw blocked('The configured target (E2E_BASE_URL) is not a valid origin.');
   }
   if (confirmedOrigin !== targetOrigin) {
      throw blocked(
         'E2E_CONFIRMED_ORIGIN does not exactly match the configured target origin. Refusing to write against an unverified target.'
      );
   }

   const uuids: Array<[string, string | undefined]> = [
      ['E2E_WORKSPACE_ID', process.env.E2E_WORKSPACE_ID],
      ['E2E_ACCOUNT_USER_ID', process.env.E2E_ACCOUNT_USER_ID],
      ['E2E_CANARY_PROJECT_ID', process.env.E2E_CANARY_PROJECT_ID],
      ['E2E_CANARY_ISSUE_ID', process.env.E2E_CANARY_ISSUE_ID],
   ];
   const normalized: string[] = [];
   for (const [name, value] of uuids) {
      const trimmed = value!.trim();
      if (!UUID_PATTERN.test(trimmed)) {
         throw blocked(`${name} is not a UUID. Refusing to write against an unverified fixture.`);
      }
      normalized.push(trimmed.toLowerCase());
   }

   return {
      workspaceId: normalized[0],
      accountUserId: normalized[1],
      canaryProjectId: normalized[2],
      canaryIssueId: normalized[3],
      confirmedOrigin,
      injectFailureAfterWrite:
         (process.env.E2E_INJECT_FAILURE ?? '').trim() === INJECT_FAILURE_AFTER_WRITE,
   };
}

export function formatUnknown(value: unknown): string {
   if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
   }
   return String(value);
}
