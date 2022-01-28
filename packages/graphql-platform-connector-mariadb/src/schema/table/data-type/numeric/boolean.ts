import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface BooleanTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
    BooleanType['kind'] | 'BOOL',
    1 | 0,
    TLeafValue
  > {}

/**
 * @see https://mariadb.com/kb/en/boolean/
 */
export class BooleanType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'BOOLEAN', 1 | 0, TLeafValue> {
  public constructor(
    config?: SetOptional<BooleanTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'BOOLEAN',
        serialize: (value) => value.toString(10),
        fromColumnValue: config?.fromColumnValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );
  }
}
