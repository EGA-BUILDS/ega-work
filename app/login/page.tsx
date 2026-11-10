import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { LoginForm } from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { safeNextPath } from '@/lib/auth/redirect';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
   title: 'Sign in',
   description: 'Sign in to EGA Work with your password or an email link.',
};

type LoginSearchParams = {
   next?: string | string[];
   error?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
   return Array.isArray(value) ? value[0] : value;
}

function loginErrorMessage(code: string | undefined): string | undefined {
   if (code === 'link') {
      return 'That sign-in link is invalid or has expired. Request a new one.';
   }

   return undefined;
}

export default async function LoginPage({
   searchParams,
}: {
   searchParams: Promise<LoginSearchParams>;
}) {
   const params = await searchParams;
   const next = safeNextPath(firstValue(params.next));
   const config = readSupabaseConfig();

   if (!config.ok) {
      return (
         <AuthShell>
            <div className="mx-auto w-full max-w-md">
               <Card>
                  <CardHeader>
                     <h1 className="text-xl font-semibold tracking-tight">Sign in to EGA Work</h1>
                     <CardDescription className="text-muted-foreground text-sm">
                        Sign-in is unavailable until this environment is configured.
                     </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <ConfigMissingAlert context="Sign-in" />
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

   const supabase = await createSupabaseServerClient();
   if (supabase) {
      const result = await supabase.auth.getUser().catch(() => null);
      if (result?.data.user) redirect(next);
   }

   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-md">
            <Card>
               <CardHeader>
                  <h1 className="text-xl font-semibold tracking-tight">Sign in to EGA Work</h1>
                  <CardDescription className="text-muted-foreground text-sm">
                     Use your existing account password, or request a sign-in link.
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <LoginForm
                     next={next}
                     initialError={loginErrorMessage(firstValue(params.error))}
                  />
                  <p className="mt-4 text-center text-sm">
                     <Link href="/account/reset" className="underline underline-offset-4">
                        Forgot your password?
                     </Link>
                  </p>
               </CardContent>
               <CardFooter>
                  <Button variant="ghost" size="sm" asChild>
                     <Link href="/">Back to home</Link>
                  </Button>
               </CardFooter>
            </Card>
         </div>
      </AuthShell>
   );
}
