'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { updatePassword } from '@/app/account/actions';
import { INITIAL_ACCOUNT_STATE } from '@/lib/auth/account-state';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SetPasswordForm() {
   const [state, action, pending] = useActionState(updatePassword, INITIAL_ACCOUNT_STATE);
   const saved = state.status === 'saved';

   return (
      <form action={action} className="grid gap-4">
         <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
               id="new-password"
               name="password"
               type="password"
               autoComplete="new-password"
               minLength={PASSWORD_MIN_LENGTH}
               maxLength={PASSWORD_MAX_LENGTH}
               required
               disabled={pending}
            />
         </div>
         <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
               id="confirm-password"
               name="confirmation"
               type="password"
               autoComplete="new-password"
               minLength={PASSWORD_MIN_LENGTH}
               maxLength={PASSWORD_MAX_LENGTH}
               required
               disabled={pending}
            />
         </div>

         {saved ? (
            <Alert role="status">
               <AlertTitle>Password updated</AlertTitle>
               <AlertDescription>{state.message}</AlertDescription>
            </Alert>
         ) : null}

         {state.status === 'error' ? (
            <Alert variant="destructive" role="alert">
               <AlertTitle>Password not changed</AlertTitle>
               <AlertDescription>{state.message}</AlertDescription>
            </Alert>
         ) : null}

         <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Set password'}
         </Button>

         {saved ? (
            <Button variant="outline" asChild>
               <Link href="/me">Continue to workspace</Link>
            </Button>
         ) : (
            <Link href="/account/reset" className="text-sm underline underline-offset-4">
               Request a new recovery link
            </Link>
         )}
      </form>
   );
}
