import type {
   GithubConnectionRecord,
   GithubConnectionStatus,
   GithubInstallationView,
   GithubPullRequestView,
   GithubStatusView,
   GithubTimestamp,
   PullRequestRecord,
} from './types';

const PULL_REQUEST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
   rate_limited: 'GitHub is rate limiting checks. The last saved result is shown.',
   outage: 'GitHub did not respond. The last saved result is shown.',
   installation_unavailable:
      'The GitHub App installation cannot access this repository. Check the installation.',
   not_found: 'This pull request is no longer available on GitHub.',
   reauthorization_required: 'GitHub access expired. Reconnect GitHub to check again.',
};

const FALLBACK_PR_ERROR = 'The last check did not complete. The last saved result is shown.';

function iso(value: GithubTimestamp): string | null {
   if (!value) {
      return null;
   }
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Stable UTC label so server and client render the same text. */
export function utcLabel(value: GithubTimestamp): string | null {
   const serialized = iso(value);
   if (!serialized) {
      return null;
   }
   const date = new Date(serialized);
   const pad = (part: number) => String(part).padStart(2, '0');
   return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate()
   )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function presentStatus(
   configured: boolean,
   row: GithubConnectionRecord | null,
   unavailable = false
): GithubStatusView {
   if (!configured) {
      return {
         configured: false,
         status: 'unconfigured',
         login: null,
         installationId: null,
         connectedAt: null,
      };
   }

   if (unavailable) {
      return {
         configured: true,
         status: 'unavailable',
         login: null,
         installationId: null,
         connectedAt: null,
      };
   }

   if (!row) {
      return {
         configured: true,
         status: 'disconnected',
         login: null,
         installationId: null,
         connectedAt: null,
      };
   }

   const hasToken = Boolean(row.token_ciphertext && row.token_iv && row.token_tag);
   const status: GithubConnectionStatus =
      row.revoked_at || !hasToken ? 'reauthorization_required' : 'connected';

   return {
      configured: true,
      status,
      login: status === 'connected' ? row.login : null,
      installationId:
         status === 'connected' && row.installation_id !== null
            ? String(row.installation_id)
            : null,
      connectedAt: status === 'connected' ? iso(row.connected_at) : null,
   };
}

export function presentInstallation(value: GithubInstallationView): GithubInstallationView {
   return {
      id: value.id,
      accountLogin: value.accountLogin,
      accountType: value.accountType,
      repositorySelection: value.repositorySelection,
   };
}

export function presentPullRequestError(code: string | null): string | null {
   if (!code) {
      return null;
   }
   return PULL_REQUEST_ERROR_MESSAGES[code] ?? FALLBACK_PR_ERROR;
}

/**
 * Defense-in-depth read gate. A stored observation is only projected when the
 * connection is usable, has a selected installation, and the row is visible
 * and belongs to the current connection generation. Every mutation already
 * enforces this; the server render path checks it again before exposing data.
 */
export function isPullRequestVisible(
   connection: GithubConnectionRecord | null,
   row: PullRequestRecord | null
): boolean {
   if (!connection || connection.revoked_at || !connection.token_ciphertext) {
      return false;
   }
   if (connection.installation_id === null) {
      return false;
   }
   if (!row || row.hidden) {
      return false;
   }
   return row.connection_generation === connection.connection_generation;
}

/**
 * Projects a stored pull request into the fields the browser may see. Token,
 * ciphertext, lease, and raw provider text never appear in the result. Hidden
 * rows are not public at all.
 */
export function presentPullRequest(row: PullRequestRecord | null): GithubPullRequestView | null {
   if (!row || row.hidden || !row.state || !row.url) {
      return null;
   }

   return {
      id: row.id,
      owner: row.repo_owner,
      repository: row.repo_name,
      number: row.pr_number,
      url: row.url,
      title: row.title ?? `${row.repo_owner}/${row.repo_name}#${row.pr_number}`,
      state: row.state,
      lastCheckedAt: iso(row.last_checked_at),
      lastCheckedLabel: utcLabel(row.last_checked_at),
      isStale: row.is_stale,
      error: presentPullRequestError(row.last_check_error),
   };
}
