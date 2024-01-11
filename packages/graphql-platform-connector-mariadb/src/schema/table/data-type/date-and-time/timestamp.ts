import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import type { ColumnInformation } from '../../../../statement.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface TimestampTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<TimestampType['kind'], TLeafValue, Date> {
  microsecondPrecision?: number;
}

/**
 * @see https://mariadb.com/kb/en/timestamp/
 */
export class TimestampType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'TIMESTAMP', TLeafValue, Date> {
  public readonly microsecondPrecision: number;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<TimestampTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'TIMESTAMP' }, configPath);

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
        throw new utils.UnexpectedValueError(
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
  ): Date | null {
    assert.equal(typeof columnValue, 'string');

    return /^0000-00-00 00:00:00($|\.0+$)/.test(columnValue)
      ? null
      : new Date(
          columnValue.replace(
            /^(?<date>[^ ]+) (?<time>.+)$/,
            '$<date>T$<time>Z',
          ),
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

  public isInformationValid(information: ColumnInformation): boolean {
    return (
      super.isInformationValid(information) &&
      (!information.NUMERIC_PRECISION ||
        this.microsecondPrecision === Number(information.NUMERIC_PRECISION))
    );
  }
}
