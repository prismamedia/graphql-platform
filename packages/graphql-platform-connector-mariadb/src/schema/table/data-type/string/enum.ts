import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import { escapeStringValue } from '../../../../escape.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';

export interface EnumTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<EnumType['kind'], string, TLeafValue> {
  values: ReadonlyArray<string>;
}

/**
 * @see https://mariadb.com/kb/en/enum/
 */
export class EnumType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'ENUM', string, TLeafValue> {
  public readonly values: ReadonlyArray<string>;

  public constructor(
    config: SetOptional<EnumTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind: 'ENUM',
        serialize: (value) => escapeStringValue(value),
        fromColumnValue: config?.fromColumnValue,
        toColumnValue: config?.toColumnValue,
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
