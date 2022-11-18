import type { Except, SetOptional } from 'type-fest';
import type { Leaf } from '../../../../definition/component/leaf.js';
import {
  AbstractFieldFilterInputType,
  AbstractFieldFilterInputTypeConfig,
} from '../abstract-field.js';

export type LeafFilterInputTypeConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputTypeConfig<TValue>, 'name'>,
  'public'
>;

export class LeafFilterInputType<
  TValue = any,
> extends AbstractFieldFilterInputType<TValue> {
  public constructor(
    public readonly leaf: Leaf,
    public readonly id: string,
    {
      name = id === 'eq' ? leaf.name : `${leaf.name}_${id}`,
      ...config
    }: LeafFilterInputTypeConfig<TValue>,
  ) {
    super({
      deprecated: leaf.deprecationReason,
      ...config,
      name,
      public: leaf.isPublic(),
    });
  }
}
