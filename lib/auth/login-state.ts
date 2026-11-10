export type LoginActionState =
   | { status: 'idle' }
   | { status: 'error'; message: string }
   | { status: 'sent'; email: string; message: string };
