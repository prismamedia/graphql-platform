import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface UuidTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<UuidType['kind'], TLeafValue, string> {}

/**
 * The UUID data type is intended for the storage of 128-bit UUID (Universally Unique Identifier) data
 *
 * @see https://mariadb.com/kb/en/uuid-data-type/
 */
export class UuidType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<'UUID', TLeafValue, string> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<UuidTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'UUID',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        fromJsonValue: config?.fromJsonValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );

    this.definition = this.kind;
  }
}
