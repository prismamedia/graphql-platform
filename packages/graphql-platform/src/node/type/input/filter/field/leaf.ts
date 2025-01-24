import type { Except } from 'type-fest';
import type { Leaf } from '../../../../definition.js';
import { FieldFilterInput, type FieldFilterInputConfig } from '../field.js';

export type LeafFilterInputConfig<TValue> = Except<
  FieldFilterInputConfig<TValue>,
  'name' | 'public'
>;

export class LeafFilterInput<TValue = any> extends FieldFilterInput<TValue> {
  public constructor(
    public readonly leaf: Leaf,
    public readonly id: string,
    config: LeafFilterInputConfig<TValue>,
  ) {
    super({
      deprecated: leaf.deprecationReason,
      ...config,
      name: id === 'eq' ? leaf.name : `${leaf.name}_${id}`,
      public: leaf.isPublic(),
    });
  }
}
