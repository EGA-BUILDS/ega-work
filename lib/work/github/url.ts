export type PullRequestReference = Readonly<{
   owner: string;
   repo: string;
   number: number;
}>;

export type PullRequestUrlResult =
   | { ok: true; value: PullRequestReference }
   | { ok: false; reason: 'malformed' | 'unsupported_host' | 'invalid_number' };

const PULL_REQUEST_PATH =
   /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})\/pull\/([1-9][0-9]{0,9})$/;

const MAX_PULL_REQUEST_NUMBER = 2_147_483_647;

function validOwner(owner: string): boolean {
   return !owner.startsWith('-') && !owner.endsWith('-') && !owner.includes('--');
}

function validRepo(repo: string): boolean {
   return repo !== '.' && repo !== '..' && !repo.endsWith('.');
}

/**
 * Accepts only the canonical GitHub pull-request URL form:
 * `https://github.com/<owner>/<repo>/pull/<number>`.
 *
 * The parser is deliberately strict. It rejects lookalike hosts, credentials,
 * explicit ports, queries, fragments, extra path segments, percent-encoded
 * separators, whitespace, non-https schemes, unicode, zero/leading-zero
 * numbers, and numbers outside PostgreSQL's integer range. Callers never fetch
 * a user-supplied URL; they reconstruct the API URL from the parsed parts.
 */
export function parsePullRequestUrl(raw: unknown): PullRequestUrlResult {
   if (typeof raw !== 'string') {
      return { ok: false, reason: 'malformed' };
   }

   if (raw !== raw.trim()) {
      return { ok: false, reason: 'malformed' };
   }

   if (!raw.toLowerCase().startsWith('https://')) {
      return { ok: false, reason: 'malformed' };
   }

   let host: string;
   try {
      host = new URL(raw).host;
   } catch {
      return { ok: false, reason: 'malformed' };
   }

   if (host !== 'github.com') {
      return { ok: false, reason: 'unsupported_host' };
   }

   const match = PULL_REQUEST_PATH.exec(raw);
   if (!match) {
      return { ok: false, reason: 'malformed' };
   }

   const [, owner, repo, numberText] = match;
   if (!validOwner(owner) || !validRepo(repo)) {
      return { ok: false, reason: 'malformed' };
   }

   const number = Number(numberText);
   if (!Number.isSafeInteger(number) || number < 1 || number > MAX_PULL_REQUEST_NUMBER) {
      return { ok: false, reason: 'invalid_number' };
   }

   return {
      ok: true,
      value: {
         owner: owner.toLowerCase(),
         repo: repo.toLowerCase(),
         number,
      },
   };
}

export function pullRequestUrl(reference: PullRequestReference): string {
   return `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}`;
}

export function isUuid(value: unknown): value is string {
   return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
   );
}
