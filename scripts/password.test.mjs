import assert from 'node:assert/strict';
import test from 'node:test';

import { PASSWORD_MAX_LENGTH, validateNewPassword } from '../lib/auth/password.ts';

test('new passwords must meet length and confirmation rules', () => {
   assert.deepEqual(validateNewPassword('correct horse', 'correct horse'), {
      ok: true,
      password: 'correct horse',
   });
   assert.deepEqual(validateNewPassword('', ''), {
      ok: false,
      error: 'Enter a new password.',
   });
   assert.deepEqual(validateNewPassword('short', 'short'), {
      ok: false,
      error: 'Use at least 8 characters.',
   });
   assert.deepEqual(validateNewPassword('long enough', 'different'), {
      ok: false,
      error: 'The passwords do not match.',
   });
   assert.equal(
      validateNewPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1), 'x'.repeat(PASSWORD_MAX_LENGTH + 1))
         .ok,
      false
   );
   assert.equal(validateNewPassword(null, null).ok, false);
});
