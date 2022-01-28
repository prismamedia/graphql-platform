import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';
import type { NumericDataTypeModifier } from './modifier.js';

export interface DecimalTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
    DecimalType['kind'] | 'DEC' | 'FIXED' | 'NUMERIC',
    number,
    TLeafValue
  > {
  precision?: number;
  scale?: number;
  modifiers?: ReadonlyArray<NumericDataTypeModifier>;
}

/**
 * @see https://mariadb.com/kb/en/decimal/
 */
export class DecimalType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<'DECIMAL', number, TLeafValue> {
  public readonly precision: number;
  public readonly scale: number;
  public readonly modifiers: ReadonlyArray<NumericDataTypeModifier>;

  public constructor(
    config?: SetOptional<DecimalTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({
      kind: 'DECIMAL',
      serialize: (value) => value.toString(10),
      fromColumnValue: config?.fromColumnValue,
      toColumnValue: config?.toColumnValue,
    });

    if (config?.precision != null) {
      const precisionConfig = config?.precision;
      const precisionConfigPath = utils.addPath(configPath, 'precision');

      if (!Number.isInteger(precisionConfig)) {
        throw new utils.UnexpectedConfigError('an integer', precisionConfig, {
          path: precisionConfigPath,
        });
      } else if (precisionConfig < 1) {
        throw new utils.UnexpectedConfigError(
          'an integer greater-than-or-equal to 1',
          precisionConfig,
          { path: precisionConfigPath },
        );
      } else if (precisionConfig > 65) {
        throw new utils.UnexpectedConfigError(
          'an integer less-than-or-equal to 65',
          precisionConfig,
          { path: precisionConfigPath },
        );
      }

      this.precision = config.precision;
    } else {
      this.precision = 10;
    }

    if (config?.scale != null) {
      const scaleConfig = config?.scale;
      const scaleConfigPath = utils.addPath(configPath, 'scale');

      if (!Number.isInteger(scaleConfig)) {
        throw new utils.UnexpectedConfigError('an integer', scaleConfig, {
          path: scaleConfigPath,
        });
      } else if (scaleConfig < 0) {
        throw new utils.UnexpectedConfigError(
          'an integer greater-than-or-equal to 0',
          scaleConfig,
          { path: scaleConfigPath },
        );
      } else if (scaleConfig > 38) {
        throw new utils.UnexpectedConfigError(
          'an integer less-than-or-equal to 38',
          scaleConfig,
          { path: scaleConfigPath },
        );
      }

      this.scale = scaleConfig;
    } else {
      this.scale = 0;
    }

    this.modifiers = Object.freeze([...new Set(config?.modifiers)]);
  }

  @Memoize()
  public override get definition(): string {
    return [
      `${this.kind}(${this.precision},${this.scale})`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }
}
