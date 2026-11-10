export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordValidation = { ok: true; password: string } | { ok: false; error: string };

export function validateNewPassword(password: unknown, confirmation: unknown): PasswordValidation {
   if (typeof password !== 'string' || password.length === 0) {
      return { ok: false, error: 'Enter a new password.' };
   }
   if (password.length < PASSWORD_MIN_LENGTH) {
      return {
         ok: false,
         error: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      };
   }
   if (password.length > PASSWORD_MAX_LENGTH) {
      return { ok: false, error: `Keep the password under ${PASSWORD_MAX_LENGTH} characters.` };
   }
   if (typeof confirmation !== 'string' || confirmation !== password) {
      return { ok: false, error: 'The passwords do not match.' };
   }
   return { ok: true, password };
}
