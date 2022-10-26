import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { JsonObject, SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface JsonTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<JsonType['kind'], TLeafValue, JsonObject> {}

/**
 * @see https://mariadb.com/kb/en/json-data-type/
 */
export class JsonType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'JSON', TLeafValue, JsonObject> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<JsonTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'JSON' }, configPath);

    this.definition = this.kind;
  }

  protected override doParseColumnValue(
    // As the connection is configured with "autoJsonMap: false"
    columnValue: string,
  ): JsonObject {
    assert.equal(typeof columnValue, 'string');

    return JSON.parse(columnValue);
  }

  protected override doParseJsonValue(
    // MariaDB automatically parses the JSON column, so we do not do it twice
    jsonValue: JsonObject,
  ): JsonObject {
    assert.equal(typeof jsonValue, 'object');

    return jsonValue;
  }

  protected override doSerialize(value: JsonObject): string {
    assert.equal(typeof value, 'object');

    return escapeStringValue(JSON.stringify(value));
  }
}
