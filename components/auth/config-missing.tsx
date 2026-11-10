import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ConfigMissingAlert({ context }: { context: string }) {
   return (
      <Alert variant="destructive">
         <AlertTitle>Authentication is not configured</AlertTitle>
         <AlertDescription>
            <p>
               {context} needs a Supabase project. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
               <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in this environment. Server-only{' '}
               <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> are also supported.
            </p>
            <p>
               Then restart the app. See <code>docs/auth.md</code> for the redirect URL setup.
            </p>
         </AlertDescription>
      </Alert>
   );
}
