import assert from 'node:assert/strict';
import test from 'node:test';

import {
   TOKEN_KEY_BYTES,
   decryptSecret,
   encryptSecret,
   pkceChallenge,
   randomToken,
   sha256Hex,
} from '../lib/work/github/crypto.ts';

const KEY = Buffer.alloc(TOKEN_KEY_BYTES, 7);

function tamper(value) {
   const first = value[0] === 'A' ? 'B' : 'A';
   return first + value.slice(1);
}

test('AES-256-GCM round-trips a secret and never reuses an IV', () => {
   const first = encryptSecret(KEY, 'ghu_example-token-value');
   const second = encryptSecret(KEY, 'ghu_example-token-value');

   assert.equal(decryptSecret(KEY, first), 'ghu_example-token-value');
   assert.notEqual(first.iv, second.iv);
   assert.notEqual(first.ciphertext, second.ciphertext);
   assert.ok(first.tag.length > 0);
});

test('altered IV, tag, or ciphertext fails closed', () => {
   const secret = encryptSecret(KEY, 'ghu_secret');

   assert.equal(decryptSecret(KEY, { ...secret, iv: tamper(secret.iv) }), null);
   assert.equal(decryptSecret(KEY, { ...secret, tag: tamper(secret.tag) }), null);
   assert.equal(decryptSecret(KEY, { ...secret, ciphertext: tamper(secret.ciphertext) }), null);
   assert.equal(decryptSecret(KEY, { ...secret, ciphertext: '' }), null);
   assert.equal(decryptSecret(KEY, { ...secret, iv: 'AAAA' }), null);
   assert.equal(decryptSecret(KEY, {}), null);
});

test('wrong or short encryption keys fail closed', () => {
   const secret = encryptSecret(KEY, 'ghu_secret');
   const wrong = Buffer.alloc(TOKEN_KEY_BYTES, 9);

   assert.equal(decryptSecret(wrong, secret), null);
   assert.equal(decryptSecret(Buffer.alloc(16, 7), secret), null);
   assert.throws(() => encryptSecret(Buffer.alloc(31, 7), 'secret'), /encryption key unavailable/);
   assert.throws(() => encryptSecret(Buffer.alloc(0), 'secret'), /encryption key unavailable/);
});

test('SHA-256 hashing matches the standard vector', () => {
   assert.equal(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
   );
   assert.equal(sha256Hex('').length, 64);
   assert.match(sha256Hex('state-value'), /^[0-9a-f]{64}$/);
});

test('PKCE S256 matches the RFC 7636 vector', () => {
   assert.equal(
      pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
   );
});

test('random tokens are base64url with the expected entropy', () => {
   const first = randomToken(32);
   const second = randomToken(32);

   assert.match(first, /^[A-Za-z0-9_-]{43}$/);
   assert.notEqual(first, second);
   assert.equal(Buffer.from(first, 'base64url').length, 32);
});
