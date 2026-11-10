const homeDateFormatter = new Intl.DateTimeFormat('en-US', {
   month: 'short',
   day: 'numeric',
   timeZone: 'UTC',
});

export function formatHomeDate(value: string): string {
   return homeDateFormatter.format(new Date(value));
}
