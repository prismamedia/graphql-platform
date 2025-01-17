import type { Except, SetOptional } from 'type-fest';
import type { Edge } from '../../../../definition/component/edge.js';
import {
  AbstractFieldFilterInput,
  type AbstractFieldFilterInputConfig,
} from '../abstract-field.js';

export type EdgeFilterInputConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputConfig<TValue>, 'name'>,
  'public'
>;

export class EdgeFilterInput<
  TValue = any,
> extends AbstractFieldFilterInput<TValue> {
  public constructor(
    public readonly edge: Edge,
    public readonly id: string,
    {
      name = id === 'eq' ? edge.name : `${edge.name}_${id}`,
      ...config
    }: EdgeFilterInputConfig<TValue>,
  ) {
    super({
      deprecated: edge.deprecationReason,
      ...config,
      name,
      public: edge.isPublic(),
    });
  }
}
