import { Except, SetOptional } from 'type-fest';
import type { Edge } from '../../../../definition/component/edge.js';
import {
  AbstractFieldFilterInputType,
  AbstractFieldFilterInputTypeConfig,
} from '../abstract-field.js';

export type EdgeFilterInputTypeConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputTypeConfig<TValue>, 'name'>,
  'public'
>;

export class EdgeFilterInputType<
  TValue = any,
> extends AbstractFieldFilterInputType<TValue> {
  public constructor(
    public readonly edge: Edge,
    public readonly id: string,
    {
      name = id === 'eq' ? edge.name : `${edge.name}_${id}`,
      ...config
    }: EdgeFilterInputTypeConfig<TValue>,
  ) {
    super({
      deprecated: edge.deprecationReason,
      ...config,
      name,
      public: edge.isPublic(),
    });
  }
}
