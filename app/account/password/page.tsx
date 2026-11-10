import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { loadAccount } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
   title: 'Set a password',
   description: 'Set a password for your verified EGA Work account.',
};

export default async function SetPasswordPage() {
   const account = await loadAccount('/account/password');

   if (account.kind === 'config') {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-md">
               <ConfigMissingAlert context="Password setup" />
            </div>
         </AuthShell>
      );
   }

   if (account.kind === 'unavailable') {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-md">
               <Alert variant="destructive">
                  <AlertTitle>We could not verify this recovery session</AlertTitle>
                  <AlertDescription>
                     <p>Nothing was changed. Try the recovery link again or request a new one.</p>
                     <p>
                        <Link href="/account/reset" className="underline underline-offset-4">
                           Request a new link
                        </Link>
                        .
                     </p>
                  </AlertDescription>
               </Alert>
            </div>
         </AuthShell>
      );
   }

   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-md">
            <Card>
               <CardHeader>
                  <h1 className="text-xl font-semibold tracking-tight">Set a password</h1>
                  <CardDescription>
                     Signed in as {account.user.email ?? 'your account'}. Use at least 8 characters.
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <SetPasswordForm />
               </CardContent>
            </Card>
            <div className="mt-4 text-center">
               <Button variant="ghost" size="sm" asChild>
                  <Link href="/">Back to home</Link>
               </Button>
            </div>
         </div>
      </AuthShell>
   );
}
