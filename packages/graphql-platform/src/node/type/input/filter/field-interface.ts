import type * as utils from '@prismamedia/graphql-platform-utils';
import type { OperationContext } from '../../../operation.js';
import type { BooleanFilter } from '../../../statement.js';

export interface FieldFilterInputInterface<TValue = any>
  extends utils.Input<TValue> {
  filter(
    value: Exclude<TValue, undefined>,
    context: OperationContext | undefined,
    path: utils.Path,
  ): BooleanFilter;
}
