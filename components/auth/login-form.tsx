'use client';

import { useActionState } from 'react';

import { sendMagicLink, signInWithPassword } from '@/app/login/actions';
import type { LoginActionState } from '@/lib/auth/login-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: LoginActionState = { status: 'idle' };

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
   const [passwordState, passwordAction, passwordPending] = useActionState(
      signInWithPassword,
      initialState
   );
   const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

   const errorMessage =
      state.status === 'error' ? state.message : state.status === 'idle' ? initialError : undefined;
   const sent = state.status === 'sent';
   const buttonLabel = pending
      ? 'Sending link…'
      : sent
        ? 'Send another link'
        : 'Email me a sign-in link';

   return (
      <div className="grid gap-6">
         <form action={passwordAction} className="grid gap-4">
            <input type="hidden" name="next" value={next} />
            <div className="grid gap-2">
               <Label htmlFor="password-email">Email address</Label>
               <Input
                  id="password-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
               />
            </div>
            <div className="grid gap-2">
               <Label htmlFor="password">Password</Label>
               <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
               />
            </div>
            {passwordState.status === 'error' ? (
               <Alert variant="destructive" role="alert">
                  <AlertTitle>Sign-in did not complete</AlertTitle>
                  <AlertDescription>{passwordState.message}</AlertDescription>
               </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={passwordPending}>
               {passwordPending ? 'Signing in…' : 'Sign in with password'}
            </Button>
         </form>
         <form action={formAction} className="grid gap-4">
            <p className="text-sm text-muted-foreground">Or sign in with an email link</p>
            <input type="hidden" name="next" value={next} />

            <div className="grid gap-2">
               <Label htmlFor="email">Email address</Label>
               <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                  aria-invalid={errorMessage ? true : undefined}
               />
            </div>

            {sent ? (
               <Alert role="status">
                  <AlertTitle>Check your inbox</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
               </Alert>
            ) : null}

            {errorMessage ? (
               <Alert variant="destructive">
                  <AlertTitle>Sign-in did not complete</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
               </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
               {buttonLabel}
            </Button>

            <p className="text-xs leading-relaxed text-muted-foreground">
               New to EGA Work? The same link creates your account. The link opens in this browser
               so the sign-in session can be verified.
            </p>
         </form>
      </div>
   );
}
