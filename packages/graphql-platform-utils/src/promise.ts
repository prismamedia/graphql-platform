import * as R from 'remeda';
import type { Promisable } from 'type-fest';

export const PromiseTry = <TReturn, TArgs extends any[]>(
  fn: (...args: TArgs) => Promisable<TReturn>,
  ...args: TArgs
) => new Promise<TReturn>((resolve) => resolve(fn(...args)));

export async function PromiseAllSettledThenThrowIfErrors<T>(
  values: Iterable<T | PromiseLike<T>>,
): Promise<Awaited<T>[]> {
  const results = await Promise.allSettled(values);

  const errors = R.pipe(
    results,
    R.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    ),
    R.map((result) => result.reason),
  );

  if (errors.length) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors);
  }

  return (results as PromiseFulfilledResult<Awaited<T>>[]).map(
    ({ value }) => value,
  );
}
