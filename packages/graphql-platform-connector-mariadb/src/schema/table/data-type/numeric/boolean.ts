import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface BooleanTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
    BooleanType['kind'] | 'BOOL',
    TLeafValue,
    boolean
  > {}

/**
 * @see https://mariadb.com/kb/en/boolean/
 */
export class BooleanType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'BOOLEAN', TLeafValue, boolean> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<BooleanTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'BOOLEAN' }, configPath);

    this.definition = this.kind;
  }

  protected override doParseColumnValue(columnValue: 1 | 0): boolean {
    return columnValue === 1;
  }

  protected override doSerialize(value: boolean): string {
    assert.equal(typeof value, 'boolean');

    return value ? '1' : '0';
  }
}
