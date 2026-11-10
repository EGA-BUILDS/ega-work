'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
   Box,
   Check,
   ContactRound,
   FolderKanban,
   GitPullRequestArrow,
   Home,
   Inbox,
   Info,
   Menu,
   UserRound,
   X,
   type LucideIcon,
} from 'lucide-react';

import { WorkOverview } from '@/components/home/work-overview';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
   SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { DEFAULT_ORG_ID as ORG_ID } from '@/components/home/demo-data';

interface NavItem {
   label: string;
   href: string;
   icon: LucideIcon;
}

const WORK_NAV: NavItem[] = [
   { label: 'Home', href: '/demo', icon: Home },
   { label: 'My issues', href: `/${ORG_ID}/my-issues`, icon: FolderKanban },
   { label: 'Reviews', href: `/${ORG_ID}/reviews`, icon: GitPullRequestArrow },
   { label: 'Inbox', href: `/${ORG_ID}/inbox`, icon: Inbox },
];

const WORKSPACE_NAV: NavItem[] = [
   { label: 'Projects', href: `/${ORG_ID}/projects`, icon: Box },
   { label: 'Teams', href: `/${ORG_ID}/teams`, icon: ContactRound },
   { label: 'Members', href: `/${ORG_ID}/members`, icon: UserRound },
];

function BrandMark() {
   return (
      <span
         aria-hidden="true"
         className="flex size-7 items-center justify-center rounded-md bg-teal-600 text-white dark:bg-teal-500 dark:text-teal-950"
      >
         <Check className="size-4" strokeWidth={3} />
      </span>
   );
}

interface NavLinkProps {
   item: NavItem;
   active: boolean;
   className?: string;
   onSelect?: () => void;
}

function NavLink({ item, active, className, onSelect }: NavLinkProps) {
   return (
      <Link
         href={item.href}
         aria-current={active ? 'page' : undefined}
         onClick={onSelect}
         className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
            active
               ? 'bg-accent text-foreground'
               : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            className
         )}
      >
         <item.icon aria-hidden="true" className="size-4" />
         <span>{item.label}</span>
      </Link>
   );
}

export function HomeShell() {
   const pathname = usePathname();
   const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
   const [noticeVisible, setNoticeVisible] = React.useState(true);

   const isItemActive = (href: string): boolean =>
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

   return (
      <div className="flex min-h-svh flex-col">
         <a
            href="#main-content"
            className="fixed left-4 top-4 z-50 -translate-y-14 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-md outline-none ring-2 ring-ring transition-transform focus:translate-y-0 motion-reduce:transition-none"
         >
            Skip to content
         </a>

         <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
               <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="xl:hidden"
                        aria-label="Open navigation menu"
                     >
                        <Menu aria-hidden="true" className="size-5" />
                     </Button>
                  </SheetTrigger>
                  <SheetContent
                     side="left"
                     className="w-72 gap-0 p-0 motion-reduce:animate-none motion-reduce:transition-none"
                  >
                     <SheetHeader className="border-b px-4 py-3">
                        <SheetTitle className="flex items-center gap-2 text-base">
                           <BrandMark />
                           <span>EGA Work</span>
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                           Primary navigation
                        </SheetDescription>
                     </SheetHeader>
                     <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                           {WORK_NAV.map((item) => (
                              <NavLink
                                 key={item.href}
                                 item={item}
                                 active={isItemActive(item.href)}
                                 className="h-9 w-full justify-start"
                                 onSelect={() => setMobileNavOpen(false)}
                              />
                           ))}
                        </div>
                        <Separator className="my-3" />
                        <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                           Workspace
                        </p>
                        <div className="flex flex-col gap-0.5">
                           {WORKSPACE_NAV.map((item) => (
                              <NavLink
                                 key={item.href}
                                 item={item}
                                 active={isItemActive(item.href)}
                                 className="h-9 w-full justify-start"
                                 onSelect={() => setMobileNavOpen(false)}
                              />
                           ))}
                        </div>
                     </nav>
                     <SheetFooter className="mt-auto border-t p-3">
                        <p className="text-xs text-muted-foreground">
                           Demo workspace — sample data only. Nothing is saved.
                        </p>
                     </SheetFooter>
                  </SheetContent>
               </Sheet>

               <Link
                  href="/demo"
                  aria-label="EGA Work home"
                  className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
               >
                  <BrandMark />
                  <span className="text-[15px] font-semibold tracking-tight">EGA Work</span>
               </Link>

               <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 xl:flex">
                  {WORK_NAV.map((item) => (
                     <NavLink key={item.href} item={item} active={isItemActive(item.href)} />
                  ))}
                  <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                  {WORKSPACE_NAV.map((item) => (
                     <NavLink key={item.href} item={item} active={isItemActive(item.href)} />
                  ))}
               </nav>

               <div className="ml-auto flex items-center gap-2">
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                     Demo data
                  </Badge>
                  <ThemeToggle />
               </div>
            </div>
         </header>

         {noticeVisible && (
            <div className="border-b bg-muted/40">
               <div
                  role="note"
                  aria-label="Demo data notice"
                  className="mx-auto flex w-full max-w-6xl items-start gap-2.5 px-4 py-2.5 sm:px-6"
               >
                  <Info
                     aria-hidden="true"
                     className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400"
                  />
                  <p className="text-sm text-muted-foreground">
                     <span className="font-medium text-foreground">Demo workspace.</span> Records
                     below are sample data. Nothing is saved, and no live GitHub connection is
                     active.
                  </p>
                  <Button
                     variant="ghost"
                     size="icon"
                     className="ml-auto size-7 shrink-0"
                     onClick={() => setNoticeVisible(false)}
                     aria-label="Dismiss demo data notice"
                  >
                     <X aria-hidden="true" className="size-4" />
                  </Button>
               </div>
            </div>
         )}

         <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
         >
            <div className="mb-6 flex flex-col gap-1">
               <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Work overview</h1>
               <p className="text-sm text-muted-foreground">
                  Projects, issues, and pull request observations for this workspace.
               </p>
            </div>
            <WorkOverview />
         </main>

         <footer className="border-t">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
               <span>EGA Work</span>
               <span>Demo workspace — sample data only.</span>
            </div>
         </footer>
      </div>
   );
}
