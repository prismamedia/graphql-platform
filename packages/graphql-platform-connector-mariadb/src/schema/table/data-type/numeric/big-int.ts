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

export interface BigIntTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractNumericDataTypeConfig<
    BigIntType['kind'] | 'INT8',
    TLeafValue,
    bigint
  > {
  length?: number;
  modifiers?: ReadonlyArray<NumericDataTypeModifier>;
}

/**
 * @see https://mariadb.com/kb/en/int/
 */
export class BigIntType<
  TLeafValue extends core.LeafValue = any,
> extends AbstractNumericDataType<'BIGINT', TLeafValue, bigint> {
  public readonly length?: number;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<BigIntTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super({ ...config, kind: 'BIGINT' });

    if (config?.length != null) {
      const lengthConfig = config?.length;
      const lengthConfigPath = utils.addPath(configPath, 'length');

      if (!Number.isInteger(lengthConfig)) {
        throw new utils.UnexpectedValueError('an integer', lengthConfig, {
          path: lengthConfigPath,
        });
      } else if (lengthConfig < 1) {
        throw new utils.UnexpectedValueError(
          'an integer greater-than-or-equal to 1',
          lengthConfig,
          { path: lengthConfigPath },
        );
      }

      this.length = lengthConfig;
    }

    this.definition = [
      `${this.kind}${this.length ? `(${this.length})` : ''}`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected override doParseColumnValue(columnValue: bigint): bigint {
    assert.strictEqual(
      typeof columnValue,
      'bigint',
      `"${this.kind}" column expects a "bigint", got: ${typeof columnValue}`,
    );

    return columnValue;
  }

  protected override doParseJsonValue(jsonValue: number): bigint {
    assert.strictEqual(
      typeof jsonValue,
      'number',
      `"${this.kind}" column expects a "number", got: ${typeof jsonValue}`,
    );

    return BigInt(jsonValue);
  }

  protected override doSerialize(value: bigint | number): string {
    assert(['bigint', 'number'].includes(typeof value));

    return value.toString(10);
  }

  public override isInformationValid(information: ColumnInformation): boolean {
    return (
      super.isInformationValid(information) &&
      (!this.length ||
        !utils.baseEnCollator.compare(
          this.definition.split(' ')[0],
          information.COLUMN_TYPE.split(' ')[0],
        ))
    );
  }
}
