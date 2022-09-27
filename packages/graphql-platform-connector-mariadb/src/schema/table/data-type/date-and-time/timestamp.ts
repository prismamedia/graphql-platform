import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface TimestampTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<TimestampType['kind'], TLeafValue, number> {
  microsecondPrecision?: number;
}

/**
 * @see https://mariadb.com/kb/en/timestamp/
 */
export class TimestampType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<'TIMESTAMP', TLeafValue, number> {
  public readonly microsecondPrecision: number;

  public constructor(
    config?: SetOptional<TimestampTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'TIMESTAMP',
        serialize: (value) => value.toString(10),
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
