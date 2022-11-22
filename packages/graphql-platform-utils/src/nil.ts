export type Nil = undefined | null;

export const isNil = (maybeNil: unknown): maybeNil is Nil => maybeNil == null;

export type Nillable<T> = T | Nil;

export type NonNillable<T> = Exclude<T, Nil>;
