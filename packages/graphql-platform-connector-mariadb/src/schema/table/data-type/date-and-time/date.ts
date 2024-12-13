import type * as core from '@prismamedia/graphql-platform';
import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface DateTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<DateType['kind'], TLeafValue, Date> {}

/**
 * @see https://mariadb.com/kb/en/date/
 */
export class DateType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'DATE', TLeafValue, Date> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<DateTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'DATE' }, configPath);

    this.definition = this.kind;
  }

  protected override doParseColumnValue(
    // As the connection is configured with "dateStrings: true"
    columnValue: string,
  ): Date | null {
    assert.strictEqual(typeof columnValue, 'string');

    return columnValue === '0000-00-00' ? null : scalars.parseDate(columnValue);
  }

  protected override doSerialize(value: Date): string {
    assert(value instanceof Date);

    return escapeStringValue(value.toISOString().split('T')[0]);
  }
}
