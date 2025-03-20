import type { Promisable } from 'type-fest';

export const PromiseTry = <TReturn, TArgs extends any[]>(
  fn: (...args: TArgs) => Promisable<TReturn>,
  ...args: TArgs
) => new Promise<TReturn>((resolve) => resolve(fn(...args)));
