export const SEARCH_QUERY_MAX = 100;

/** Escapes user input so `%` and `_` are literal in a Postgres LIKE pattern. */
export function escapeLikePattern(value: string): string {
   return value.replace(/[\\%_]/g, '\\$&');
}

/** Returns the numeric issue number for a query like `W-12`, or null. */
export function issueNumberFromQuery(value: string): number | null {
   const match = /^w-(\d{1,15})$/i.exec(value.trim());
   if (!match) {
      return null;
   }
   const number = Number(match[1]);
   return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function normalizeSearchQuery(value: string): string {
   return value.trim().slice(0, SEARCH_QUERY_MAX);
}
