import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface BooleanTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<
    BooleanType['kind'] | 'BOOL',
    TLeafValue,
    1 | 0
  > {}

/**
 * @see https://mariadb.com/kb/en/boolean/
 */
export class BooleanType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<'BOOLEAN', TLeafValue, 1 | 0> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<BooleanTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'BOOLEAN',
        serialize: (value) => value.toString(10),
        fromColumnValue: config?.fromColumnValue,
        fromJsonValue: config?.fromJsonValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );

    this.definition = this.kind;
  }
}
