import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface JsonTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<
    JsonType['kind'],
    TLeafValue,
    string,
    utils.PlainObject
  > {}

/**
 * @see https://mariadb.com/kb/en/json-data-type/
 */
export class JsonType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<
  'JSON',
  TLeafValue,
  // As the connection is configured with "autoJsonMap: false"
  string,
  utils.PlainObject
> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<JsonTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'JSON',
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
