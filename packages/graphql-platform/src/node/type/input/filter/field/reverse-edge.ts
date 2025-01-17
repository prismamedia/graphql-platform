import type { Except, SetOptional } from 'type-fest';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import {
  AbstractFieldFilterInput,
  type AbstractFieldFilterInputConfig,
} from '../abstract-field.js';

export type ReverseEdgeFilterInputConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputConfig<TValue>, 'name'>,
  'public'
>;

export class ReverseEdgeFilterInput<
  TValue = any,
> extends AbstractFieldFilterInput<TValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    public readonly id: string,
    {
      name = id === 'eq' ? reverseEdge.name : `${reverseEdge.name}_${id}`,
      ...config
    }: ReverseEdgeFilterInputConfig<TValue>,
  ) {
    super({
      deprecated: reverseEdge.deprecationReason,
      ...config,
      name,
      public: reverseEdge.isPublic(),
    });
  }
}
