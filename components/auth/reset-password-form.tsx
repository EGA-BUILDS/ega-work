'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { requestPasswordReset } from '@/app/account/actions';
import { INITIAL_ACCOUNT_STATE } from '@/lib/auth/account-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPasswordForm() {
   const [state, action, pending] = useActionState(requestPasswordReset, INITIAL_ACCOUNT_STATE);
   const sent = state.status === 'sent';

   return (
      <form action={action} className="grid gap-4">
         <div className="grid gap-2">
            <Label htmlFor="recovery-email">Email address</Label>
            <Input
               id="recovery-email"
               name="email"
               type="email"
               inputMode="email"
               autoComplete="email"
               maxLength={254}
               required
               disabled={pending}
               placeholder="you@example.com"
            />
         </div>

         {sent ? (
            <Alert role="status">
               <AlertTitle>Check your inbox</AlertTitle>
               <AlertDescription>{state.message}</AlertDescription>
            </Alert>
         ) : null}

         {state.status === 'error' ? (
            <Alert variant="destructive" role="alert">
               <AlertTitle>Recovery link not sent</AlertTitle>
               <AlertDescription>{state.message}</AlertDescription>
            </Alert>
         ) : null}

         <Button type="submit" disabled={pending}>
            {pending ? 'Sending link…' : sent ? 'Send another link' : 'Send recovery link'}
         </Button>

         <p className="text-muted-foreground text-xs leading-relaxed">
            Open the link in this browser. It returns here so the session can be verified before you
            choose a new password.
         </p>

         <Link href="/login" className="text-sm underline underline-offset-4">
            Back to sign in
         </Link>
      </form>
   );
}
