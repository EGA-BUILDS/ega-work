import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
   { href: '#product', label: 'Product' },
   { href: '#principles', label: 'Principles' },
   { href: '/demo', label: 'Demo' },
];

export function MarketingBrand({ className }: { className?: string }) {
   return (
      <Link
         href="/"
         aria-label="EGA Work home"
         className={cn(
            'flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
         )}
      >
         <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-md bg-teal-600 text-white dark:bg-teal-500 dark:text-teal-950"
         >
            <Check className="size-4" strokeWidth={3} />
         </span>
         <span className="text-[15px] font-semibold tracking-tight">EGA Work</span>
      </Link>
   );
}

export function MarketingHeader() {
   return (
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
         <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
            <MarketingBrand />

            <nav aria-label="Marketing" className="ml-4 hidden items-center gap-0.5 md:flex">
               {NAV_LINKS.map((link) => (
                  <Link
                     key={link.href}
                     href={link.href}
                     className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  >
                     {link.label}
                  </Link>
               ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
               <Button variant="ghost" size="sm" asChild>
                  <Link href="/demo" className="hidden sm:inline-flex">
                     Explore demo
                  </Link>
               </Button>
               <Button size="sm" asChild>
                  <Link href="/login">Log in</Link>
               </Button>
            </div>
         </div>
      </header>
   );
}
