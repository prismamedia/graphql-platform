import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';
import type { NumericDataTypeModifier } from './modifier.js';

export interface IntTypeConfig<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataTypeConfig<
    IntType['kind'] | 'INT4' | 'INT3' | 'INT2' | 'INT1',
    TLeafValue,
    number
  > {
  length?: number;
  modifiers?: ReadonlyArray<NumericDataTypeModifier>;
}

/**
 * @see https://mariadb.com/kb/en/int/
 */
export class IntType<
  TLeafValue extends NonNullable<core.LeafValue> = any,
> extends AbstractDataType<
  'INT' | 'MEDIUMINT' | 'SMALLINT' | 'TINYINT',
  TLeafValue,
  number
> {
  public readonly length?: number;
  public readonly modifiers: ReadonlyArray<NumericDataTypeModifier>;

  public constructor(
    config?: SetOptional<IntTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        kind:
          !config?.kind || config.kind === 'INT4'
            ? 'INT'
            : config.kind === 'INT3'
            ? 'MEDIUMINT'
            : config.kind === 'INT2'
            ? 'SMALLINT'
            : config.kind === 'INT1'
            ? 'TINYINT'
            : config.kind,
        serialize: (value) => value.toString(10),
        fromColumnValue: config?.fromColumnValue,
        fromJsonValue: config?.fromJsonValue,
        toColumnValue: config?.toColumnValue,
      },
      configPath,
    );

    if (config?.length != null) {
      const lengthConfig = config?.length;
      const lengthConfigPath = utils.addPath(configPath, 'length');

      if (!Number.isInteger(lengthConfig)) {
        throw new utils.UnexpectedConfigError('an integer', lengthConfig, {
          path: lengthConfigPath,
        });
      } else if (lengthConfig < 1) {
        throw new utils.UnexpectedConfigError(
          'an integer greater-than-or-equal to 1',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

    this.modifiers = Object.freeze([...new Set(config?.modifiers)]);
  }

  @Memoize()
  public override get definition(): string {
    return [
      `${this.kind}${this.length ? `(${this.length})` : ''}`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }
}
