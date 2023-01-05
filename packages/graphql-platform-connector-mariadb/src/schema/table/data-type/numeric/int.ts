import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type { SetOptional } from 'type-fest';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../../abstract-data-type.js';
import type { NumericDataTypeModifier } from './modifier.js';

export interface IntTypeConfig<TLeafValue extends core.LeafValue = any>
  extends AbstractDataTypeConfig<
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
  TLeafValue extends core.LeafValue = any,
> extends AbstractDataType<
  'INT' | 'MEDIUMINT' | 'SMALLINT' | 'TINYINT',
  TLeafValue,
  number
> {
  public readonly length?: number;
  public readonly modifiers: ReadonlyArray<NumericDataTypeModifier>;
  public readonly definition: string;

  public constructor(
    config?: SetOptional<IntTypeConfig<TLeafValue>, 'kind'>,
    configPath?: utils.Path,
  ) {
    super(
      {
        ...config,
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
      },
      configPath,
    );

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

    this.modifiers = Object.freeze([...new Set(config?.modifiers)]);

    this.definition = [
      `${this.kind}${this.length ? `(${this.length})` : ''}`,
      this.modifiers?.join(' '),
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected override doSerialize(value: number): string {
    assert.equal(typeof value, 'number');
    assert(Number.isInteger(value));

    return value.toString(10);
  }
}
