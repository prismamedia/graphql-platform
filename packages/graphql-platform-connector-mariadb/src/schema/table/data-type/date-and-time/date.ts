import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface DateTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<DateType['kind'], TLeafValue, string> {}

/**
 * @see https://mariadb.com/kb/en/date/
 */
export class DateType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<
  'DATE',
  TLeafValue,
  // As the connection is configured with "dateStrings: true"
  string
> {
  public readonly definition: string;

  public constructor(
    config?: SetOptional<DateTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'DATE',
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
