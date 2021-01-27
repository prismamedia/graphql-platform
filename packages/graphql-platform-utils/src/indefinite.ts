import base from 'indefinite';
import { Except } from 'type-fest';
import { getOptionalFlag } from './optional-flag';

export interface IndefiniteOptions {
  quote?: boolean;
}

export const indefinite = (
  subject: string | { toString(): string },
  options?: IndefiniteOptions,
): string =>
  getOptionalFlag(options?.quote, false)
    ? `${base(String(subject), { articleOnly: true })} "${subject}"`
    : base(String(subject));

export const indefiniteQuote = (
  subject: string | { toString(): string },
  options?: Except<IndefiniteOptions, 'quote'>,
): string => indefinite(subject, { ...options, quote: true });
