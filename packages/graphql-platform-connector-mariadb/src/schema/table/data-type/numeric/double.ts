import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { SetOptional } from 'type-fest';
import type { ColumnInformation } from '../../../../statement.js';
import {
  AbstractNumericDataType,
  type AbstractNumericDataTypeConfig,
} from '../abstract-numeric-data-type.js';
import type { NumericDataTypeModifier } from './modifier.js';

export interface DoubleTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractNumericDataTypeConfig<
    DoubleType['kind'] | 'DOUBLE PRECISION' | 'REAL',
    TLeafValue,
    number
  > {
  precision?: number;
  scale?: number;
  modifiers?: ReadonlyArray<NumericDataTypeModifier>;
}

/**
 * @see https://mariadb.com/kb/en/double/
 */
export class DoubleType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractNumericDataType<'DOUBLE', TLeafValue, number> {
  public readonly precision?: number;
  public readonly scale?: number;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<DoubleTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'DOUBLE' });

    if (config?.precision != null) {
      const precisionConfig = config?.precision;
      const precisionConfigPath = utils.addPath(configPath, 'precision');

      if (!Number.isInteger(precisionConfig)) {
        throw new utils.UnexpectedValueError('an integer', precisionConfig, {
          path: precisionConfigPath,
        });
      } else if (precisionConfig < 1) {
        throw new utils.UnexpectedValueError(
          'an integer greater-than-or-equal to 1',
          precisionConfig,
          { path: precisionConfigPath },
        );
      } else if (precisionConfig > 65) {
        throw new utils.UnexpectedValueError(
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
        throw new utils.UnexpectedValueError('an integer', scaleConfig, {
          path: scaleConfigPath,
        });
      } else if (scaleConfig < 0) {
        throw new utils.UnexpectedValueError(
          'an integer greater-than-or-equal to 0',
          scaleConfig,
          { path: scaleConfigPath },
        );
      } else if (scaleConfig > 38) {
        throw new utils.UnexpectedValueError(
          'an integer less-than-or-equal to 38',
          scaleConfig,
          { path: scaleConfigPath },
        );
      }

      this.scale = scaleConfig;
    } else {
      this.scale = 0;
    }

    this.definition = [
      `${this.kind}(${this.precision},${this.scale})`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected override doSerialize(value: number): string {
    assert.strictEqual(typeof value, 'number');

    return value.toString(10);
  }

  public override isInformationValid(information: ColumnInformation): boolean {
    return (
      super.isInformationValid(information) &&
      (!this.precision ||
        !information.NUMERIC_PRECISION ||
        this.precision === Number(information.NUMERIC_PRECISION)) &&
      (!this.scale ||
        !information.NUMERIC_SCALE ||
        this.scale === Number(information.NUMERIC_SCALE))
    );
  }
}
