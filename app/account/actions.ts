'use server';

import { headers } from 'next/headers';

import type { AccountActionState } from '@/lib/auth/account-state';
import { isValidEmail, normalizeEmail } from '@/lib/auth/email';
import { validateNewPassword } from '@/lib/auth/password';
import { resolveSiteOrigin } from '@/lib/auth/site-origin';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function protocolFromOrigin(value: string | null): 'http' | 'https' | undefined {
   if (!value) {
      return undefined;
   }
   try {
      const { protocol } = new URL(value);
      return protocol === 'http:' ? 'http' : protocol === 'https:' ? 'https' : undefined;
   } catch {
      return undefined;
   }
}

/**
 * Requests a Supabase recovery link. The response is deliberately generic for
 * every valid email so it cannot be used to enumerate accounts.
 */
export async function requestPasswordReset(
   _previousState: AccountActionState,
   formData: FormData
): Promise<AccountActionState> {
   const email = normalizeEmail(formData.get('email'));
   if (!isValidEmail(email)) {
      return { status: 'error', message: 'Enter a valid email address.' };
   }

   if (!readSupabaseConfig().ok) {
      return {
         status: 'error',
         message: 'Password recovery is not configured on this environment.',
      };
   }

   const requestHeaders = await headers();
   const siteOrigin = resolveSiteOrigin({
      configured: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
      forwardedHost: requestHeaders.get('x-forwarded-host'),
      forwardedProto: requestHeaders.get('x-forwarded-proto'),
      host: requestHeaders.get('host'),
      defaultProtocol:
         protocolFromOrigin(requestHeaders.get('origin')) ??
         (process.env.NODE_ENV === 'production' ? 'https' : 'http'),
   });

   if (!siteOrigin.ok) {
      return {
         status: 'error',
         message: 'Password recovery is misconfigured. SITE_URL must be a valid http(s) origin.',
      };
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return {
         status: 'error',
         message: 'Password recovery is not configured on this environment.',
      };
   }

   const callbackUrl = new URL('/auth/callback', siteOrigin.origin);
   callbackUrl.searchParams.set('next', '/account/password');

   try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
         redirectTo: callbackUrl.toString(),
      });
      if (error) {
         return {
            status: 'error',
            message: 'We could not send a recovery link right now. Try again in a moment.',
         };
      }
   } catch {
      return {
         status: 'error',
         message: 'We could not reach the recovery service. Try again in a moment.',
      };
   }

   return {
      status: 'sent',
      message:
         'If an account exists for that address, we sent a recovery link. Open it in this browser to set a password.',
   };
}

/** Sets or replaces the signed-in user's password after a recovery link. */
export async function updatePassword(
   _previousState: AccountActionState,
   formData: FormData
): Promise<AccountActionState> {
   const validation = validateNewPassword(formData.get('password'), formData.get('confirmation'));
   if (!validation.ok) {
      return { status: 'error', message: validation.error };
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return {
         status: 'error',
         message: 'Password changes are not configured on this environment.',
      };
   }

   const result = await supabase.auth.getUser().catch(() => null);
   if (!result?.data.user) {
      return {
         status: 'error',
         message: 'This recovery link is no longer valid. Request a new one.',
      };
   }

   try {
      const { error } = await supabase.auth.updateUser({ password: validation.password });
      if (error) {
         return {
            status: 'error',
            message: 'The password was not changed. Request a new recovery link and try again.',
         };
      }
   } catch {
      return {
         status: 'error',
         message: 'The password was not changed. Request a new recovery link and try again.',
      };
   }

   return { status: 'saved', message: 'Password updated. You can continue to your workspace.' };
}
