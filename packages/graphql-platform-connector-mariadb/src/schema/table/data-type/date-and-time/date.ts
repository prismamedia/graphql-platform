import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escape.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface DateTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<DateType['kind'], string, TLeafValue> {}

/**
 * @see https://mariadb.com/kb/en/date/
 */
export class DateType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<
  'DATE',
  // As the connection is configured with "dateStrings: true"
  string,
  TLeafValue
> {
  public constructor(
    config?: SetOptional<DateTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'DATE',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );
  }
}
