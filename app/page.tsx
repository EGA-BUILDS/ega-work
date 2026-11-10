import type { Metadata } from 'next';

import { MarketingHome } from '@/components/marketing/marketing-home';

const title = 'EGA Work — The work, in one clear record';
const description =
   'EGA Work is a quiet workspace for projects, issues, and pull request observations. Explore the sample demo or log in.';

export const metadata: Metadata = {
   title: { absolute: title },
   description,
   openGraph: {
      type: 'website',
      title,
      description,
      siteName: 'EGA Work',
      images: [],
   },
   twitter: {
      card: 'summary',
      title,
      description,
      images: [],
   },
};

export default function HomePage() {
   return <MarketingHome />;
}
