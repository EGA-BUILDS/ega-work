import type { Metadata } from 'next';

import { HomeShell } from '@/components/home/home-shell';

const description = 'EGA Work demo workspace: explore sample projects, issues, and pull request observations.';

export const metadata: Metadata = {
   title: { absolute: 'EGA Work — Demo workspace' },
   description,
   openGraph: {
      type: 'website',
      title: 'EGA Work — Demo workspace',
      description,
      siteName: 'EGA Work',
      images: [],
   },
   twitter: {
      card: 'summary',
      title: 'EGA Work — Demo workspace',
      description,
      images: [],
   },
};

export default function HomePage() {
   return <HomeShell />;
}
