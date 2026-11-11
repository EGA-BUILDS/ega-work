export const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_API_ORIGIN = 'https://api.github.com';
export const GITHUB_WEB_ORIGIN = 'https://github.com';
export const GITHUB_OAUTH_CALLBACK_PATH = '/api/github/callback';
export const GITHUB_SETUP_PATH = '/api/github/setup';

/** 32-byte AES-256 key. Kept local so this module has no runtime imports. */
const TOKEN_KEY_BYTES = 32;

export type GithubConfig = Readonly<{
   clientId: string;
   clientSecret: string;
   appSlug: string;
   tokenEncryptionKey: Buffer;
   databaseUrl: string;
   databaseCa: string | null;
}>;

export type GithubConfigResult =
   | { configured: true; config: GithubConfig }
   | { configured: false; reason: 'missing' | 'invalid' };

type ReadonlyEnvironment = Readonly<Record<string, string | undefined>>;

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const CLIENT_SECRET_PATTERN = /^[A-Za-z0-9._-]{16,200}$/;
const APP_SLUG_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeBase64(value: string): Buffer | null {
   if (!value || !BASE64_PATTERN.test(value) || value.length % 4 !== 0) {
      return null;
   }
   const decoded = Buffer.from(value, 'base64');
   return decoded.length > 0 ? decoded : null;
}

/**
 * Reads the GitHub App user-to-server configuration from the server
 * environment. Missing or malformed values disable the feature instead of
 * throwing at import time, so unrelated pages keep working without GitHub.
 *
 * The client secret, encryption key, and runtime database URL never leave the
 * server. There is no fallback to a privileged `DATABASE_URL`.
 */
export function readGithubConfig(env: ReadonlyEnvironment = process.env): GithubConfigResult {
   const clientId = env.GITHUB_APP_CLIENT_ID?.trim() ?? '';
   const clientSecret = env.GITHUB_APP_CLIENT_SECRET?.trim() ?? '';
   const appSlug = env.GITHUB_APP_SLUG?.trim() ?? '';
   const rawKey = env.WORK_TOKEN_ENCRYPTION_KEY?.trim() ?? '';
   const databaseUrl = env.WORK_GITHUB_DATABASE_URL?.trim() ?? '';
   const rawCa = env.WORK_GITHUB_DATABASE_CA_BASE64?.trim() ?? '';

   if (!clientId || !clientSecret || !appSlug || !rawKey || !databaseUrl) {
      return { configured: false, reason: 'missing' };
   }

   if (
      !CLIENT_ID_PATTERN.test(clientId) ||
      !CLIENT_SECRET_PATTERN.test(clientSecret) ||
      !APP_SLUG_PATTERN.test(appSlug) ||
      /\s/.test(databaseUrl)
   ) {
      return { configured: false, reason: 'invalid' };
   }

   const tokenEncryptionKey = decodeBase64(rawKey);
   if (!tokenEncryptionKey || tokenEncryptionKey.length !== TOKEN_KEY_BYTES) {
      return { configured: false, reason: 'invalid' };
   }

   let database: URL;
   try {
      database = new URL(databaseUrl);
   } catch {
      return { configured: false, reason: 'invalid' };
   }

   const databasePath = database.pathname.replace(/^\/+/, '');
   if (
      (database.protocol !== 'postgres:' && database.protocol !== 'postgresql:') ||
      !database.hostname ||
      !database.username ||
      !databasePath ||
      database.search ||
      database.hash
   ) {
      return { configured: false, reason: 'invalid' };
   }

   let databaseCa: string | null = null;
   if (rawCa) {
      const decoded = decodeBase64(rawCa);
      if (!decoded) {
         return { configured: false, reason: 'invalid' };
      }
      databaseCa = decoded.toString('utf8');
   }

   return {
      configured: true,
      config: {
         clientId,
         clientSecret,
         appSlug,
         tokenEncryptionKey,
         databaseUrl,
         databaseCa,
      },
   };
}

export function githubAppInstallUrl(config: GithubConfig): string {
   return `${GITHUB_WEB_ORIGIN}/apps/${config.appSlug}/installations/new`;
}
