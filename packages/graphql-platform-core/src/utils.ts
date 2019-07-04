import { Maybe, MaybePromise } from '@prismamedia/graphql-platform-utils';
import { Logger } from 'winston';

export async function logPromiseError<T>(task: MaybePromise<T>, logger?: Maybe<Logger>): Promise<T> {
  try {
    // It is very important to keep the "await" before the awaited promise
    return await task;
  } catch (error) {
    logger && logger.error(error);

    throw error;
  }
}
