import type { GithubTimestamp } from './types';

export const ACCESS_TOKEN_SKEW_MS = 60_000;

export type TokenClassificationInput = Readonly<{
   revoked_at: GithubTimestamp;
   token_ciphertext: string | null;
   token_iv: string | null;
   token_tag: string | null;
   token_expires_at: GithubTimestamp;
   refresh_token_ciphertext: string | null;
   refresh_token_iv: string | null;
   refresh_token_tag: string | null;
   refresh_token_expires_at: GithubTimestamp;
   refresh_lease_id: string | null;
   refresh_lease_expires_at: GithubTimestamp;
}>;

export type TokenClassification =
   | { kind: 'usable'; accessExpiresAt: Date | null }
   | { kind: 'refresh' }
   | { kind: 'leased'; leaseId: string }
   | { kind: 'stalled'; leaseId: string }
   | { kind: 'unusable'; reason: 'revoked' | 'missing_refresh' | 'expired_refresh' };

function timestamp(value: GithubTimestamp): Date | null {
   if (!value) {
      return null;
   }
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Classifies one stored connection without performing I/O.
 *
 * Order matters. A revoked connection is unusable even if a token was left
 * behind. A non-expiring or still-fresh access token is usable regardless of a
 * leftover lease. Otherwise the connection needs a refresh, but an active lease
 * belongs to another worker and an expired lease may hide a consumed refresh
 * token: neither may hand out the stored access token. A missing or expired
 * refresh token is unusable and requires reconnect.
 */
export function classifyConnectionToken(
   row: TokenClassificationInput,
   now = Date.now()
): TokenClassification {
   if (row.revoked_at) {
      return { kind: 'unusable', reason: 'revoked' };
   }

   const hasAccess = Boolean(row.token_ciphertext && row.token_iv && row.token_tag);
   const accessExpiry = timestamp(row.token_expires_at);
   if (
      hasAccess &&
      (accessExpiry === null || accessExpiry.getTime() > now + ACCESS_TOKEN_SKEW_MS)
   ) {
      return { kind: 'usable', accessExpiresAt: accessExpiry };
   }

   const hasRefresh = Boolean(
      row.refresh_token_ciphertext && row.refresh_token_iv && row.refresh_token_tag
   );
   if (!hasRefresh) {
      return { kind: 'unusable', reason: 'missing_refresh' };
   }

   const refreshExpiry = timestamp(row.refresh_token_expires_at);
   if (refreshExpiry !== null && refreshExpiry.getTime() <= now) {
      return { kind: 'unusable', reason: 'expired_refresh' };
   }

   if (row.refresh_lease_id) {
      const leaseExpiry = timestamp(row.refresh_lease_expires_at);
      if (leaseExpiry !== null && leaseExpiry.getTime() > now) {
         return { kind: 'leased', leaseId: row.refresh_lease_id };
      }
      return { kind: 'stalled', leaseId: row.refresh_lease_id };
   }

   return { kind: 'refresh' };
}

export function tokenIsUsable(row: TokenClassificationInput, now = Date.now()): boolean {
   return classifyConnectionToken(row, now).kind === 'usable';
}
