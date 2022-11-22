import { isPlainObject } from './plain-object.js';

export const castToError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : isPlainObject(error)
    ? Object.assign(new Error(error.message), error)
    : new Error(error as any);
