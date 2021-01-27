export type Nullish = undefined | null;

export function isNullish(maybeNullish: unknown): maybeNullish is Nullish {
  return maybeNullish == null;
}
