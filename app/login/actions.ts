'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { isValidEmail, normalizeEmail } from '@/lib/auth/email';
import type { LoginActionState } from '@/lib/auth/login-state';
import { safeNextPath } from '@/lib/auth/redirect';
import { resolveSiteOrigin } from '@/lib/auth/site-origin';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signInWithPassword(
   _previousState: LoginActionState,
   formData: FormData
): Promise<LoginActionState> {
   const email = normalizeEmail(formData.get('email'));
   const password = formData.get('password');
   const nextValue = formData.get('next');
   const next = safeNextPath(typeof nextValue === 'string' ? nextValue : null);

   if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return { status: 'error', message: 'Enter your email address and password.' };
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return { status: 'error', message: 'Authentication is not configured on this environment.' };
   }

   try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
         return {
            status: 'error',
            message:
               error.status === 429
                  ? 'Too many sign-in attempts. Wait a moment and try again.'
                  : 'Could not sign in. Check your email and password or use a sign-in link.',
         };
      }
   } catch {
      return { status: 'error', message: 'We could not reach the sign-in service. Try again.' };
   }

   redirect(next);
}

function protocolFromOrigin(value: string | null): 'http' | 'https' | undefined {
   if (!value) {
      return undefined;
   }

   try {
      const { protocol } = new URL(value);
      if (protocol === 'http:') {
         return 'http';
      }
      if (protocol === 'https:') {
         return 'https';
      }
   } catch {
      return undefined;
   }

   return undefined;
}

/**
 * Sends a Supabase email magic link. Sign-up is explicit: a new email creates
 * an account, so the same journey supports sign-in and sign-up.
 */
export async function sendMagicLink(
   _previousState: LoginActionState,
   formData: FormData
): Promise<LoginActionState> {
   const email = normalizeEmail(formData.get('email'));
   const nextValue = formData.get('next');
   const next = safeNextPath(typeof nextValue === 'string' ? nextValue : null);

   if (!isValidEmail(email)) {
      return { status: 'error', message: 'Enter a valid email address.' };
   }

   if (!readSupabaseConfig().ok) {
      return {
         status: 'error',
         message: 'Authentication is not configured on this environment.',
      };
   }

   const requestHeaders = await headers();
   const forwardedProto = requestHeaders.get('x-forwarded-proto');
   const siteOrigin = resolveSiteOrigin({
      configured: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
      forwardedHost: requestHeaders.get('x-forwarded-host'),
      forwardedProto,
      host: requestHeaders.get('host'),
      defaultProtocol:
         protocolFromOrigin(requestHeaders.get('origin')) ??
         (process.env.NODE_ENV === 'production' ? 'https' : 'http'),
   });

   if (!siteOrigin.ok) {
      return {
         status: 'error',
         message: 'Sign-in is misconfigured. NEXT_PUBLIC_SITE_URL must be a valid http(s) origin.',
      };
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return {
         status: 'error',
         message: 'Authentication is not configured on this environment.',
      };
   }

   const callbackUrl = new URL('/auth/callback', siteOrigin.origin);
   callbackUrl.searchParams.set('next', next);

   try {
      const { error } = await supabase.auth.signInWithOtp({
         email,
         options: {
            emailRedirectTo: callbackUrl.toString(),
            shouldCreateUser: true,
         },
      });

      if (error) {
         const rateLimited =
            error.status === 429 || Boolean(error.code?.toLowerCase().includes('rate_limit'));

         return {
            status: 'error',
            message: rateLimited
               ? 'Too many sign-in email requests. Wait a minute and try again.'
               : 'We could not send the sign-in link. Try again in a moment.',
         };
      }
   } catch {
      return {
         status: 'error',
         message: 'We could not reach the sign-in service. Try again in a moment.',
      };
   }

   return {
      status: 'sent',
      email,
      message: `We sent a sign-in link to ${email}. Open it in this browser to finish signing in.`,
   };
}
