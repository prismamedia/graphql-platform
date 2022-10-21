import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escaping.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface EnumTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<EnumType['kind'], TLeafValue, string> {
  values: ReadonlyArray<string>;
}

/**
 * @see https://mariadb.com/kb/en/enum/
 */
export class EnumType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<'ENUM', TLeafValue, string> {
  public readonly values: ReadonlyArray<string>;

  public constructor(
    config: SetOptional<EnumTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'ENUM',
        serialize: (value) => escapeStringValue(value),
        toColumnValue: config.toColumnValue,
        fromColumnValue: config.fromColumnValue,
        fromJsonValue: config.fromJsonValue,
      },
      configPath,
    );

    // values
    {
      const valuesConfig = config.values;
      const valuesConfigPath = utils.addPath(configPath, 'values');

      if (!Array.isArray(valuesConfig) || !valuesConfig.length) {
        throw new utils.UnexpectedConfigError(
          'a non-empty array',
          valuesConfig,
          { path: valuesConfigPath },
        );
      }

      valuesConfig.forEach((value, index) => {
        if (typeof value !== 'string' || !value) {
          throw new utils.UnexpectedConfigError('a non-empty string', value, {
            path: utils.addPath(valuesConfigPath, index),
          });
        }
      });

      this.values = Object.freeze([...new Set(valuesConfig)]);
    }
  }

  @Memoize()
  public override get definition(): string {
    return `${this.kind}(${this.values
      .map((value) => escapeStringValue(value))
      .join(',')})`;
  }
}
