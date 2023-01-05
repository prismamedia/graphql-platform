import base from 'indefinite';
import type { Stringifiable } from './stringifiable.js';

export const indefinite = (subject: Stringifiable): string =>
  `${base(String(subject), { articleOnly: true })} "${subject}"`;
