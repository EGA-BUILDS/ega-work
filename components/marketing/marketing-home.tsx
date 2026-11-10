import Link from 'next/link';
import { ArrowRight, GitPullRequestArrow, Layers, ListChecks, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { MarketingFooter } from './marketing-footer';
import { MarketingHeader } from './marketing-header';
import { ProductPreview } from './product-preview';

interface Principle {
   title: string;
   description: string;
   icon: LucideIcon;
}

const PRINCIPLES: Principle[] = [
   {
      title: 'Completion is explicit',
      description:
         'An issue is finished when you decide it is. A merged pull request is evidence, not an automatic close.',
      icon: ListChecks,
   },
   {
      title: 'Each fact has one owner',
      description:
         'GitHub owns pull request state. Work owns issue status. Keeping them separate keeps the record honest.',
      icon: GitPullRequestArrow,
   },
   {
      title: 'One home for the work',
      description:
         'Projects and issues stay together, with progress, health, and ownership visible in a single overview.',
      icon: Layers,
   },
];

export function MarketingHome() {
   return (
      <div className="dark min-h-svh bg-background text-foreground">
         <a
            href="#main-content"
            className="fixed left-4 top-4 z-50 -translate-y-14 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-md outline-none ring-2 ring-ring transition-transform focus:translate-y-0 motion-reduce:transition-none"
         >
            Skip to content
         </a>

         <MarketingHeader />

         <main id="main-content" tabIndex={-1}>
            <section className="relative overflow-hidden border-b border-border/60">
               <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.16),transparent_62%)]"
               />
               <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
               />

               <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
                  <div className="mx-auto max-w-3xl text-center">
                     <Badge
                        variant="outline"
                        className="border-teal-500/30 bg-teal-500/10 text-teal-300"
                     >
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-400" />
                        Early preview
                     </Badge>

                     <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                        The work, in one clear record.
                     </h1>

                     <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                        EGA Work is a quiet workspace for projects, issues, and the pull requests
                        around them. Pull request state and issue completion stay separate, so the
                        record reflects decisions you make.
                     </p>

                     <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button size="lg" asChild>
                           <Link href="/login">
                              Log in
                              <ArrowRight aria-hidden="true" />
                           </Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                           <Link href="/demo">Explore the demo</Link>
                        </Button>
                     </div>

                     <p className="mt-4 text-xs text-muted-foreground">
                        The demo uses sample data. No account is required.
                     </p>
                  </div>

                  <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
                     <ProductPreview />
                  </div>
               </div>
            </section>

            <section
               id="product"
               aria-labelledby="product-heading"
               className="scroll-mt-20 border-b border-border/60"
            >
               <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                  <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                     <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-teal-400">
                           Product preview
                        </p>
                        <h2
                           id="product-heading"
                           className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
                        >
                           A workspace that reads like a record.
                        </h2>
                     </div>
                     <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground lg:justify-self-end lg:text-base">
                        Projects, issues, and pull request observations share one calm surface. Demo
                        labels sit next to sample data so it is always clear what is real.
                     </p>
                  </div>
               </div>
            </section>

            <section
               id="principles"
               aria-labelledby="principles-heading"
               className="scroll-mt-20 border-b border-border/60 bg-muted/20"
            >
               <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
                  <div className="max-w-2xl">
                     <p className="text-xs font-medium uppercase tracking-widest text-teal-400">
                        Principles
                     </p>
                     <h2
                        id="principles-heading"
                        className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
                     >
                        A few rules keep the record honest.
                     </h2>
                     <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                        The interface stays quiet so the facts can be clear: what is in progress,
                        what is waiting on review, and what is finished.
                     </p>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                     {PRINCIPLES.map((principle) => (
                        <Card key={principle.title} className="bg-card/50">
                           <CardHeader>
                              <span className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-background/60">
                                 <principle.icon
                                    aria-hidden="true"
                                    className="size-4 text-teal-400"
                                 />
                              </span>
                              <CardTitle className="mt-3 text-base">{principle.title}</CardTitle>
                              <CardDescription className="leading-relaxed">
                                 {principle.description}
                              </CardDescription>
                           </CardHeader>
                        </Card>
                     ))}
                  </div>
               </div>
            </section>

            <section aria-labelledby="closing-heading">
               <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-xl">
                     <h2
                        id="closing-heading"
                        className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
                     >
                        See the record for yourself.
                     </h2>
                     <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                        Open the demo for a guided look at the sample workspace.
                     </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                     <Button asChild>
                        <Link href="/demo">Explore the demo</Link>
                     </Button>
                     <Button variant="outline" asChild>
                        <Link href="/login">Log in</Link>
                     </Button>
                  </div>
               </div>
            </section>
         </main>

         <MarketingFooter />
      </div>
   );
}
