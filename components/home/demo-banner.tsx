import Link from 'next/link';

/**
 * Persistent label for the Circle fixture routes. Those routes are public
 * sample data and must never be mistaken for the signed-in private workspace.
 */
export function DemoBanner() {
   return (
      <div
         role="note"
         className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-3 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs shadow-lg backdrop-blur"
      >
         <strong>Demo workspace.</strong> Sample data only — nothing here is saved or private.{' '}
         <Link href="/demo" className="underline underline-offset-4">
            Demo overview
         </Link>{' '}
         ·{' '}
         <Link href="/me" className="underline underline-offset-4">
            Your workspace
         </Link>
      </div>
   );
}
