import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except } from 'type-fest';
import type { OperationContext } from '../../../operation/context.js';
import type { BooleanFilter } from '../../../statement/filter/boolean.js';

export type FieldFilterInputConfig<TValue> = Except<
  utils.InputConfig<TValue>,
  'defaultValue' | 'parser'
> & {
  filter(
    value: Exclude<TValue, undefined>,
    context: OperationContext | undefined,
    path: utils.Path,
  ): BooleanFilter;
};

export class FieldFilterInput<TValue = any> extends utils.Input<TValue> {
  public readonly filter: FieldFilterInputConfig<TValue>['filter'];

  public constructor({ filter, ...config }: FieldFilterInputConfig<TValue>) {
    super(config);

    this.filter = filter;
  }
}
