const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

export function normalizeEmail(value: FormDataEntryValue | string | null | undefined): string {
   if (typeof value !== 'string') {
      return '';
   }

   return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
   return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}
