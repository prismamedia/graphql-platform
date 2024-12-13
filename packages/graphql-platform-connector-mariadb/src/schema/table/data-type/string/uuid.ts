import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface UuidTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<UuidType['kind'], TLeafValue, string> {}

/**
 * The UUID data type is intended for the storage of 128-bit UUID (Universally Unique Identifier) data
 *
 * @see https://mariadb.com/kb/en/uuid-data-type/
 */
export class UuidType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'UUID', TLeafValue, string> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<UuidTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'UUID' }, configPath);

    this.definition = this.kind;
  }

  protected override doSerialize(value: string): string {
    assert.strictEqual(typeof value, 'string');

    return escapeStringValue(value);
  }
}
