import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function WorkspaceConfigState() {
   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-2xl">
            <ConfigMissingAlert context="Your private workspace" />
            <div className="mt-4 flex gap-2">
               <Button variant="outline" asChild>
                  <Link href="/">Back to home</Link>
               </Button>
               <Button variant="outline" asChild>
                  <Link href="/demo">Open demo</Link>
               </Button>
            </div>
         </div>
      </AuthShell>
   );
}

export function WorkspaceUnavailableState() {
   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-2xl">
            <Alert variant="destructive">
               <AlertTitle>We could not load your workspace</AlertTitle>
               <AlertDescription>
                  <p>
                     Workspace storage did not respond, or your session could not be verified.
                     Nothing was changed.
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
