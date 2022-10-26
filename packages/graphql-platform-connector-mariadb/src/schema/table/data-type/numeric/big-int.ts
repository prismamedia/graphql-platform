import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';
import type { NumericDataTypeModifier } from './modifier.js';

export interface BigIntTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
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
> extends AbstractDataType<'BIGINT', TLeafValue, bigint> {
  public readonly length?: number;
  public readonly modifiers: ReadonlyArray<NumericDataTypeModifier>;
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

    this.definition = [
      `${this.kind}${this.length ? `(${this.length})` : ''}`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected override doParseColumnValue(columnValue: bigint): bigint {
    assert.equal(typeof columnValue, 'bigint');

    return columnValue;
  }

  protected override doParseJsonValue(jsonValue: number): bigint {
    assert.equal(typeof jsonValue, 'number');

    return BigInt(jsonValue);
  }

  protected override doSerialize(value: bigint): string {
    assert.equal(typeof value, 'bigint');

    return value.toString(10);
  }
}
