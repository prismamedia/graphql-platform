import type { Except, SetOptional } from 'type-fest';
import type { Leaf } from '../../../../definition/component/leaf.js';
import {
  AbstractFieldFilterInput,
  AbstractFieldFilterInputConfig,
} from '../abstract-field.js';

export type LeafFilterInputConfig<TValue> = Except<
  SetOptional<AbstractFieldFilterInputConfig<TValue>, 'name'>,
  'public'
>;

export class LeafFilterInput<
  TValue = any,
> extends AbstractFieldFilterInput<TValue> {
  public constructor(
    public readonly leaf: Leaf,
    public readonly id: string,
    {
      name = id === 'eq' ? leaf.name : `${leaf.name}_${id}`,
      ...config
    }: LeafFilterInputConfig<TValue>,
  ) {
    super({
      deprecated: leaf.deprecationReason,
      ...config,
      name,
      public: leaf.isPublic(),
    });
  }
}
