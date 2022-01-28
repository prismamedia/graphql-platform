import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escape.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface JsonTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<JsonType['kind'], string, TLeafValue> {}

/**
 * @see https://mariadb.com/kb/en/json-data-type/
 */
export class JsonType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<
  'JSON',
  // autoJsonMap: false
  string,
  TLeafValue
> {
  public constructor(
    config?: SetOptional<JsonTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'JSON',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );
  }
}
