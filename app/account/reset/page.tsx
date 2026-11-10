import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { ConfigMissingAlert } from '@/components/auth/config-missing';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { readSupabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
   title: 'Recover access',
   description: 'Request a password recovery link for your EGA Work account.',
};

export default function ResetPasswordPage() {
   const config = readSupabaseConfig();

   return (
      <AuthShell>
         <div className="mx-auto w-full max-w-md">
            <Card>
               <CardHeader>
                  <h1 className="text-xl font-semibold tracking-tight">Recover access</h1>
                  <CardDescription>
                     Request a link to set a password. The response is the same whether or not an
                     account exists.
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  {config.ok ? <ResetPasswordForm /> : <ConfigMissingAlert context="Recovery" />}
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
