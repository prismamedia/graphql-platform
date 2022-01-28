export type Nil = undefined | null;

export function isNil(maybeNil: unknown): maybeNil is Nil {
  return maybeNil == null;
}

export type Nillable<T> = T | Nil;

export type NonNillable<T> = Exclude<T, Nil>;
