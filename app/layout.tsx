import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
   variable: '--font-geist-sans',
   subsets: ['latin'],
});

const geistMono = Geist_Mono({
   variable: '--font-geist-mono',
   subsets: ['latin'],
});

export const metadata: Metadata = {
   title: {
      template: '%s | EGA Work',
      default: 'EGA Work',
   },
   description: 'EGA Work brings projects, issues, and pull requests together.',
};

import { ThemeProvider } from '@/components/layout/theme-provider';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>) {
   return (
      <html lang="en" suppressHydrationWarning>
         <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
         </head>
         <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
            suppressHydrationWarning
         >
            <NuqsAdapter>
               <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                  {children}
                  <Toaster />
               </ThemeProvider>
            </NuqsAdapter>
         </body>
      </html>
   );
}
