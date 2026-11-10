export type AccountActionState =
   | { status: 'idle' }
   | { status: 'sent'; message: string }
   | { status: 'saved'; message: string }
   | { status: 'error'; message: string };

export const INITIAL_ACCOUNT_STATE: AccountActionState = { status: 'idle' };
