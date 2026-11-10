import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
   return (
      <div className="flex min-h-svh flex-col bg-background">
         <header className="border-b border-border/60">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
               <Link
                  href="/"
                  aria-label="EGA Work home"
                  className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
               >
                  <span
                     aria-hidden="true"
                     className="flex size-7 items-center justify-center rounded-md bg-teal-600 text-white dark:bg-teal-500 dark:text-teal-950"
                  >
                     <Check className="size-4" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] font-semibold tracking-tight">EGA Work</span>
               </Link>
               <span className="text-xs text-muted-foreground">Private workspace</span>
            </div>
         </header>

         <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
            {children}
         </main>

         <footer className="border-t border-border/60">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
               Access is verified on the server.
            </div>
         </footer>
      </div>
   );
}
