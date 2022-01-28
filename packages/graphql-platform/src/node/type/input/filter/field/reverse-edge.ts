import { Except, SetOptional } from 'type-fest';
import type { ReverseEdge } from '../../../../definition/reverse-edge.js';
import {
  AbstractFieldFilterInputType,
  AbstractFieldFilterInputTypeConfig,
} from '../abstract-field.js';

export type ReverseEdgeFilterInputTypeConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputTypeConfig<TValue>, 'name'>,
  'public'
>;

export class ReverseEdgeFilterInputType<
  TValue = any,
> extends AbstractFieldFilterInputType<TValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    public readonly id: string,
    {
      name = id === 'eq' ? reverseEdge.name : `${reverseEdge.name}_${id}`,
      ...config
    }: ReverseEdgeFilterInputTypeConfig<TValue>,
  ) {
    super({
      deprecated: reverseEdge.deprecationReason,
      ...config,
      name,
      public: reverseEdge.isPublic(),
    });
  }
}
