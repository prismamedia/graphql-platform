import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except } from 'type-fest';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type { OperationContext } from '../../../operation/context.js';
import type { BooleanFilter } from '../../../statement/filter/boolean.js';

export type AbstractFieldFilterInputTypeConfig<TValue> = Except<
  utils.InputConfig<TValue>,
  'defaultValue' | 'customParser'
> & {
  filter<TRequestContext extends object, TConnector extends ConnectorInterface>(
    value: Exclude<TValue, undefined>,
    context: OperationContext<TRequestContext, TConnector> | undefined,
    path: utils.Path,
  ): BooleanFilter;
};

export abstract class AbstractFieldFilterInputType<
  TValue,
> extends utils.Input<TValue> {
  public readonly filter: AbstractFieldFilterInputTypeConfig<TValue>['filter'];

  public constructor({
    filter,
    ...config
  }: AbstractFieldFilterInputTypeConfig<TValue>) {
    super(config);

    this.filter = filter;
  }
}
