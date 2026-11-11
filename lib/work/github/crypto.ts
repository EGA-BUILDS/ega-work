import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

export const TOKEN_KEY_BYTES = 32;
export const TOKEN_IV_BYTES = 12;
export const TOKEN_TAG_BYTES = 16;

export type EncryptedSecret = Readonly<{
   ciphertext: string;
   iv: string;
   tag: string;
}>;

function validKey(key: Buffer): boolean {
   return Buffer.isBuffer(key) && key.length === TOKEN_KEY_BYTES;
}

function decodeField(value: string, expectedLength: number | null): Buffer | null {
   if (typeof value !== 'string' || !value) {
      return null;
   }
   const decoded = Buffer.from(value, 'base64');
   if (expectedLength !== null && decoded.length !== expectedLength) {
      return null;
   }
   return decoded.length > 0 ? decoded : null;
}

/**
 * Encrypts a secret with AES-256-GCM. A random 96-bit IV is generated for
 * every call; the authentication tag is stored separately. Callers keep the
 * three fields server-side only.
 */
export function encryptSecret(key: Buffer, plaintext: string): EncryptedSecret {
   if (!validKey(key)) {
      throw new Error('encryption key unavailable');
   }

   const iv = randomBytes(TOKEN_IV_BYTES);
   const cipher = createCipheriv('aes-256-gcm', key, iv);
   const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

   return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
   };
}

/**
 * Decrypts a stored secret. Any missing field, wrong key, altered ciphertext,
 * IV, or tag fails closed and returns null. The caller must treat null as an
 * unusable credential, never as an empty string.
 */
export function decryptSecret(key: Buffer, secret: Partial<EncryptedSecret>): string | null {
   if (!validKey(key)) {
      return null;
   }

   const ciphertext = decodeField(secret.ciphertext ?? '', null);
   const iv = decodeField(secret.iv ?? '', TOKEN_IV_BYTES);
   const tag = decodeField(secret.tag ?? '', TOKEN_TAG_BYTES);
   if (!ciphertext || !iv || !tag) {
      return null;
   }

   try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const value = plaintext.toString('utf8');
      return value ? value : null;
   } catch {
      return null;
   }
}

export function sha256Hex(value: string): string {
   return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Opaque random token encoded as base64url (unreserved characters only). */
export function randomToken(byteLength = 32): string {
   return randomBytes(byteLength).toString('base64url');
}

export function randomId(): string {
   return randomUUID();
}

/** PKCE S256: base64url(SHA-256(verifier)). */
export function pkceChallenge(verifier: string): string {
   return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}
