import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function DataErrorState({ workspaceId }: { workspaceId?: string }) {
   return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
         <Alert variant="destructive">
            <AlertTitle>We could not load this view</AlertTitle>
            <AlertDescription>
               The saved data did not load. Nothing was changed. Try again in a moment.
            </AlertDescription>
         </Alert>
         {workspaceId ? (
            <Button variant="outline" asChild className="self-start">
               <Link href={`/w/${workspaceId}`}>Back to workspace</Link>
            </Button>
         ) : null}
      </div>
   );
}
