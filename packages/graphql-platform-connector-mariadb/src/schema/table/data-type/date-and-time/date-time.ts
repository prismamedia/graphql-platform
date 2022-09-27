import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface DateTimeTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<DateTimeType['kind'], TLeafValue, string> {
  microsecondPrecision?: number;
}

/**
 * @see https://mariadb.com/kb/en/datetime/
 */
export class DateTimeType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<
  'DATETIME',
  TLeafValue,
  // As the connection is configured with "dateStrings: true"
  string
> {
  public readonly microsecondPrecision: number;

  public constructor(
    config?: SetOptional<DateTimeTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'DATETIME',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        fromJsonValue: config?.fromJsonValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );

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
  }

  @Memoize()
  public override get definition(): string {
    return `${this.kind}(${this.microsecondPrecision})`;
  }
}
