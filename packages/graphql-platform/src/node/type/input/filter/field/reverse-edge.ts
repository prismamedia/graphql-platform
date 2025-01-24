import assert from 'node:assert';
import type { Except } from 'type-fest';
import {
  MultipleReverseEdge,
  type ReverseEdge,
} from '../../../../definition.js';
import { FieldFilterInput, type FieldFilterInputConfig } from '../field.js';

export type ReverseEdgeFilterInputConfig<TValue> = Except<
  FieldFilterInputConfig<TValue>,
  'name' | 'public'
>;

export class ReverseEdgeFilterInput<
  TValue = any,
> extends FieldFilterInput<TValue> {
  public constructor(
    public readonly reverseEdge: ReverseEdge,
    public readonly id: string,
    config: ReverseEdgeFilterInputConfig<TValue>,
  ) {
    let name: string;
    if (id.startsWith('count_')) {
      assert(reverseEdge instanceof MultipleReverseEdge);
      const countId = id.replace(/^count_/, '');

      name =
        countId === 'eq'
          ? reverseEdge.countFieldName
          : `${reverseEdge.countFieldName}_${countId}`;
    } else {
      name = id === 'eq' ? reverseEdge.name : `${reverseEdge.name}_${id}`;
    }

    super({
      deprecated: reverseEdge.deprecationReason,
      ...config,
      name,
      public: reverseEdge.isPublic(),
    });
  }
}
