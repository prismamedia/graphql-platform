import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escape.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface UuidTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<UuidType['kind'], string, TLeafValue> {}

/**
 * The UUID data type is intended for the storage of 128-bit UUID (Universally Unique Identifier) data
 *
 * @see https://mariadb.com/kb/en/uuid-data-type/
 */
export class UuidType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'UUID', string, TLeafValue> {
  public constructor(
    config?: SetOptional<UuidTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'UUID',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );
  }
}
