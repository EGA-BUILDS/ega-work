import Link from 'next/link';

const FOOTER_LINKS = [
   { href: '/demo', label: 'Demo' },
   { href: '/login', label: 'Log in' },
];

export function MarketingFooter() {
   return (
      <footer className="border-t border-border/60">
         <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>EGA Work — a clear record of work.</p>
            <nav aria-label="Footer" className="flex items-center gap-4">
               {FOOTER_LINKS.map((link) => (
                  <Link
                     key={link.href}
                     href={link.href}
                     className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  >
                     {link.label}
                  </Link>
               ))}
            </nav>
         </div>
      </footer>
   );
}
