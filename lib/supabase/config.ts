export type SupabaseConfig = Readonly<{
   url: string;
   anonKey: string;
}>;

export type SupabaseConfigResult =
   | { ok: true; config: SupabaseConfig }
   | { ok: false; reason: 'missing' | 'invalid' };

type ReadonlyEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Reads the public Supabase credentials from the server environment.
 *
 * Server-only names are preferred so the values can be changed at runtime;
 * the conventional NEXT_PUBLIC names remain supported for existing setups.
 * Missing or malformed configuration is returned instead of thrown so auth
 * pages can render an honest configuration state during development and build.
 */
export function readSupabaseConfig(env: ReadonlyEnvironment = process.env): SupabaseConfigResult {
   const rawUrl = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
   const anonKey = env.SUPABASE_ANON_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

   if (!rawUrl || !anonKey) {
      return { ok: false, reason: 'missing' };
   }

   if (/\s/.test(anonKey)) {
      return { ok: false, reason: 'invalid' };
   }

   let url: URL;
   try {
      url = new URL(rawUrl);
   } catch {
      return { ok: false, reason: 'invalid' };
   }

   if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'invalid' };
   }

   if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return { ok: false, reason: 'invalid' };
   }

   return { ok: true, config: { url: url.origin, anonKey } };
}
