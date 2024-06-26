import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except } from 'type-fest';
import type { OperationContext } from '../../../operation/context.js';
import type { BooleanFilter } from '../../../statement/filter/boolean.js';
import type { FieldFilterInputInterface } from './field-interface.js';

export type AbstractFieldFilterInputConfig<TValue> = Except<
  utils.InputConfig<TValue>,
  'defaultValue' | 'parser'
> & {
  filter(
    value: Exclude<TValue, undefined>,
    context: OperationContext | undefined,
    path: utils.Path,
  ): BooleanFilter;
};

export abstract class AbstractFieldFilterInput<TValue>
  extends utils.Input<TValue>
  implements FieldFilterInputInterface<TValue>
{
  public readonly filter: AbstractFieldFilterInputConfig<TValue>['filter'];

  public constructor({
    filter,
    ...config
  }: AbstractFieldFilterInputConfig<TValue>) {
    super(config);

    this.filter = filter;
  }
}
