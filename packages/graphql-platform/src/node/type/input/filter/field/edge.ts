import type { Except } from 'type-fest';
import type { Edge } from '../../../../definition.js';
import { FieldFilterInput, type FieldFilterInputConfig } from '../field.js';

export type EdgeFilterInputConfig<TValue> = Except<
  FieldFilterInputConfig<TValue>,
  'name' | 'public'
>;

export class EdgeFilterInput<TValue = any> extends FieldFilterInput<TValue> {
  public constructor(
    public readonly edge: Edge,
    public readonly id: string,
    config: EdgeFilterInputConfig<TValue>,
  ) {
    super({
      deprecated: edge.deprecationReason,
      ...config,
      name: id === 'eq' ? edge.name : `${edge.name}_${id}`,
      public: edge.isPublic(),
    });
  }
}
