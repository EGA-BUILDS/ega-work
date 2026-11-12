import { redirect } from 'next/navigation';

// Render on demand so the unknown-route fallback returns a real HTTP redirect
// (307 to `/`). Next 15.5 otherwise prerenders this page statically and serves
// 404 with only a client-side NEXT_REDIRECT payload, breaking the fallback contract.
export const dynamic = 'force-dynamic';

export default function NotFound() {
   redirect('/');
}
