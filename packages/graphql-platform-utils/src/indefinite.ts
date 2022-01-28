import base from 'indefinite';

export const indefinite = (subject: string | { toString(): string }): string =>
  `${base(String(subject), { articleOnly: true })} "${subject}"`;
