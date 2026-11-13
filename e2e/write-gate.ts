import { UUID_PATTERN } from './account';
import { parseOrigin, validateTarget } from '../scripts/e2e-target.mjs';

/**
 * Owner-only write gate for canary W01–W03 (issue #31).
 *
 * Everything is validated at test runtime — never at config load — so
 * `playwright test --list` works with no write-related env set. The agent
 * must never run write mode and never set these variables.
 *
 * The write path additionally re-validates the target against the same
 * explicit allowlist used by the preflight (validateTarget in
 * scripts/e2e-target.mjs), so canary writes cannot run against an
 * unallowlisted origin even when Playwright is invoked directly with
 * `--project=canary-write`.
 */

export const WRITES_OPT_IN = 'I_ACCEPT_TEST_DATA';
export const INJECT_FAILURE_AFTER_WRITE = 'after-write';
export const KNOWN_FAILURE_INJECTIONS: readonly string[] = [INJECT_FAILURE_AFTER_WRITE];

export type WriteGateEnv = {
   workspaceId: string;
   /** Shape-checked only; ownership of the account cannot be verified here. The owner confirms it out-of-band. */
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
 *
 * Independent of the `test:e2e` preflight: the canary path re-checks the
 * target against the explicit allowlist so a direct
 * `playwright test --project=canary-write` cannot bypass it. The `baseURL`
 * argument is still cross-checked when provided; the authoritative target is
 * E2E_BASE_URL (as re-validated here).
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

   // Authoritative target validation — same rules and allowlist as the preflight.
   const target = validateTarget(process.env);
   if (!target.ok) {
      throw blocked(`the configured target is not authorized: ${target.reasons.join(', ')}.`);
   }

   const confirmed = parseOrigin(process.env.E2E_CONFIRMED_ORIGIN!.trim(), 'E2E_CONFIRMED_ORIGIN');
   if (!confirmed.ok) {
      throw blocked(
         'E2E_CONFIRMED_ORIGIN is not a valid http(s) origin (no path, query, or credentials).'
      );
   }
   if (confirmed.origin !== target.baseUrl) {
      throw blocked(
         'E2E_CONFIRMED_ORIGIN does not exactly match the authorized target origin (E2E_BASE_URL). ' +
            'Refusing to write against an unverified target.'
      );
   }
   if (baseURL !== undefined && originOf(baseURL) !== target.baseUrl) {
      throw blocked('The Playwright baseURL does not match the authorized target origin.');
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

   const injectFailure = (process.env.E2E_INJECT_FAILURE ?? '').trim();
   if (injectFailure !== '' && !KNOWN_FAILURE_INJECTIONS.includes(injectFailure)) {
      throw blocked(
         `E2E_INJECT_FAILURE='${injectFailure}' is not a known failure injection. ` +
            `Known values: ${KNOWN_FAILURE_INJECTIONS.join(', ')}.`
      );
   }

   return {
      workspaceId: normalized[0],
      accountUserId: normalized[1],
      canaryProjectId: normalized[2],
      canaryIssueId: normalized[3],
      confirmedOrigin: confirmed.origin,
      injectFailureAfterWrite: injectFailure === INJECT_FAILURE_AFTER_WRITE,
   };
}

export function formatUnknown(value: unknown): string {
   if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
   }
   return String(value);
}
