import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getOrCreateWorkspace } from '@/lib/work/auth';
import { loadAccount } from '@/lib/work/page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
   title: 'Your workspace',
   description: 'Your private EGA Work workspace, protected by a verified Supabase session.',
};

export default async function MePage() {
   const account = await loadAccount('/me');

   if (account.kind === 'config') {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-2xl">
               <ConfigMissingAlert context="Your private workspace" />
               <div className="mt-4">
                  <Button variant="outline" asChild>
                     <Link href="/">Back to home</Link>
                  </Button>
               </div>
            </div>
         </AuthShell>
      );
   }

   if (account.kind === 'unavailable') {
      return <VerificationError />;
   }

   const workspace = await getOrCreateWorkspace(account.supabase, account.user);
   if (!workspace.ok) {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-2xl">
               <Alert variant="destructive">
                  <AlertTitle>Your workspace could not be opened</AlertTitle>
                  <AlertDescription>
                     <p>
                        Workspace storage did not respond. Nothing was created or changed in your
                        account.
                     </p>
                     <p>
                        <Link href="/me" className="underline underline-offset-4">
                           Try again
                        </Link>
                        .
                     </p>
                  </AlertDescription>
               </Alert>
            </div>
         </AuthShell>
      );
   }

   redirect(`/w/${workspace.workspace.id}`);
}

function VerificationError() {
   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-2xl">
            <Alert variant="destructive">
               <AlertTitle>We could not verify your session</AlertTitle>
               <AlertDescription>
                  <p>
                     Supabase did not respond while checking your sign-in. Your session has not been
                     trusted for this request.
                  </p>
                  <p>
                     <Link href="/me" className="underline underline-offset-4">
                        Try again
                     </Link>{' '}
                     or{' '}
                     <Link href="/login" className="underline underline-offset-4">
                        sign in again
                     </Link>
                     .
                  </p>
               </AlertDescription>
            </Alert>
         </div>
      </AuthShell>
   );
}
