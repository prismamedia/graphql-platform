import type { IfAny } from 'type-fest';

export type Arrayable<T> = Array<T> | T;
export type ReadonlyArrayable<T> = ReadonlyArray<T> | T;

export const resolveArrayable = <T extends ReadonlyArrayable<any>>(
  arrayable: T,
): IfAny<T, Array<any>, T extends ReadonlyArray<any> ? T : Array<T>> =>
  (Array.isArray(arrayable) ? arrayable : [arrayable]) as any;
