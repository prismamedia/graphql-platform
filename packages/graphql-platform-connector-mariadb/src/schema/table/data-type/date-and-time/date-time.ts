import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface DateTimeTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<DateTimeType['kind'], TLeafValue, Date> {
  microsecondPrecision?: number;
}

/**
 * @see https://mariadb.com/kb/en/datetime/
 */
export class DateTimeType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'DATETIME', TLeafValue, Date> {
  public readonly microsecondPrecision: number;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<DateTimeTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'DATETIME' }, configPath);

    if (config?.microsecondPrecision != null) {
      const microsecondPrecisionConfig = config?.microsecondPrecision;
      const microsecondPrecisionConfigPath = utils.addPath(
        configPath,
        'microsecondPrecision',
      );

      if (
        !Number.isInteger(microsecondPrecisionConfig) ||
        microsecondPrecisionConfig < 0 ||
        microsecondPrecisionConfig > 6
      ) {
        throw new utils.UnexpectedConfigError(
          'an integer between 0 and 6',
          microsecondPrecisionConfig,
          { path: microsecondPrecisionConfigPath },
        );
      }

      this.microsecondPrecision = microsecondPrecisionConfig;
    } else {
      this.microsecondPrecision = 0;
    }

    this.definition = `${this.kind}(${this.microsecondPrecision})`;
  }

  protected override doParseColumnValue(
    // As the connection is configured with "dateStrings: true"
    columnValue: string,
  ): Date {
    assert.equal(typeof columnValue, 'string');

    return new Date(
      columnValue.replace(/^(?<date>[^ ]+) (?<time>.+)$/, '$<date>T$<time>Z'),
    );
  }

  protected override doSerialize(value: Date): string {
    assert(value instanceof Date);

    return escapeStringValue(
      value
        .toISOString()
        .replace(/^(?<date>[^T]+)T(?<time>[^Z]+)Z$/, '$<date> $<time>'),
    );
  }
}
