import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { loginPath } from '@/lib/auth/redirect';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
   title: 'Your space',
   description: 'Your private EGA Work space, protected by a verified Supabase session.',
};

type MeSearchParams = {
   error?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
   return Array.isArray(value) ? value[0] : value;
}

function formatTimestamp(value: string | undefined): string {
   if (!value) {
      return 'Not available';
   }

   const date = new Date(value);
   if (Number.isNaN(date.getTime())) {
      return 'Not available';
   }

   return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
   }).format(date);
}

export default async function MePage({ searchParams }: { searchParams: Promise<MeSearchParams> }) {
   const params = await searchParams;

   if (!readSupabaseConfig().ok) {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-2xl">
               <ConfigMissingAlert context="Your personal space" />
               <div className="mt-4">
                  <Button variant="outline" asChild>
                     <Link href="/">Back to home</Link>
                  </Button>
               </div>
            </div>
         </AuthShell>
      );
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-2xl">
               <ConfigMissingAlert context="Your personal space" />
               <div className="mt-4">
                  <Button variant="outline" asChild>
                     <Link href="/">Back to home</Link>
                  </Button>
               </div>
            </div>
         </AuthShell>
      );
   }

   const userResult = await supabase.auth.getUser().catch(() => null);
   if (!userResult) {
      return <VerificationError />;
   }

   const { data, error } = userResult;
   if (!data.user) {
      if (error?.name === 'AuthSessionMissingError' || !error) {
         redirect(loginPath('/me'));
      }

      return <VerificationError />;
   }

   const user = data.user;
   const metadata = user.user_metadata;
   const fullName =
      typeof metadata?.full_name === 'string'
         ? metadata.full_name.trim()
         : typeof metadata?.name === 'string'
           ? metadata.name.trim()
           : '';
   const displayName = fullName || user.email?.split('@')[0] || 'there';
   const signOutFailed = firstValue(params.error) === 'signout';

   return (
      <AuthShell>
         <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
               <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Your space</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                     Welcome, {displayName}. Signed in as{' '}
                     <span className="text-foreground font-medium">{user.email ?? user.id}</span>.
                  </p>
               </div>
               <form action="/auth/signout" method="post">
                  <Button type="submit" variant="outline" size="sm">
                     Sign out
                  </Button>
               </form>
            </div>

            {signOutFailed ? (
               <Alert variant="destructive">
                  <AlertTitle>Sign-out did not complete</AlertTitle>
                  <AlertDescription>
                     Your session could not be cleared. Try again, or close this browser.
                  </AlertDescription>
               </Alert>
            ) : null}

            <Card>
               <CardHeader>
                  <h2 className="leading-none font-semibold">Verified account</h2>
                  <CardDescription>
                     This page renders only after the server verifies your Supabase session.
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                     <div className="grid gap-1">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd className="font-medium break-all">
                           {user.email ?? 'No email on this account'}
                        </dd>
                     </div>
                     <div className="grid gap-1">
                        <dt className="text-muted-foreground">Account ID</dt>
                        <dd className="font-mono text-xs break-all">{user.id}</dd>
                     </div>
                     <div className="grid gap-1">
                        <dt className="text-muted-foreground">Sign-in method</dt>
                        <dd>Email magic link</dd>
                     </div>
                     <div className="grid gap-1">
                        <dt className="text-muted-foreground">Last sign-in</dt>
                        <dd>{formatTimestamp(user.last_sign_in_at)}</dd>
                     </div>
                  </dl>
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <h2 className="leading-none font-semibold">No projects yet</h2>
                  <CardDescription>
                     Your private project space is empty because workspace storage is not connected
                     in this build.
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <p className="text-muted-foreground text-sm">
                     There is no mock or shared data here. When project storage is added, only
                     records owned by this verified account will appear.
                  </p>
               </CardContent>
               <CardFooter>
                  <Button variant="outline" asChild>
                     <Link href="/">Back to home</Link>
                  </Button>
               </CardFooter>
            </Card>
         </div>
      </AuthShell>
   );
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
                     <Link href={loginPath('/me')} className="underline underline-offset-4">
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
