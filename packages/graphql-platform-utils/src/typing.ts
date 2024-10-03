import type {
  IfAny as BaseIfAny,
  IfNever as BaseIfNever,
  IfUnknown as BaseIfUnknown,
} from 'type-fest';

export type IfAny<TMaybeAny, TIfAny> = BaseIfAny<TMaybeAny, TIfAny, TMaybeAny>;

export type IfNever<TMaybeNever, TIfNever> = BaseIfNever<
  TMaybeNever,
  TIfNever,
  TMaybeNever
>;

export type IfUnknown<TMaybeUnknown, TIfUnknown> = BaseIfUnknown<
  TMaybeUnknown,
  TIfUnknown,
  TMaybeUnknown
>;
