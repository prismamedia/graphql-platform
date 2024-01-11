import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import type { ColumnInformation } from '../../../statement.js';
import {
  AbstractDataType,
  type AbstractDataTypeConfig,
} from '../abstract-data-type.js';
import type { NumericDataTypeModifier } from './numeric/modifier.js';

export interface AbstractNumericDataTypeConfig<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> extends AbstractDataTypeConfig<TKind, TLeafValue, TValue> {
  modifiers?: ReadonlyArray<NumericDataTypeModifier>;
}

export abstract class AbstractNumericDataType<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> extends AbstractDataType<TKind, TLeafValue, TValue> {
  public readonly modifiers: ReadonlyArray<NumericDataTypeModifier>;

  public constructor(
    config: AbstractNumericDataTypeConfig<TKind, TLeafValue, TValue>,
    configPath?: utils.Path,
  ) {
    super(config, configPath);

    this.modifiers = Object.freeze(
      [...new Set(config?.modifiers)].filter(
        // As it is the default, we don't need to specify it
        (modifier) => modifier !== 'SIGNED',
      ),
    );
  }

  public isInformationValid(information: ColumnInformation): boolean {
    const actualModifiers = information.COLUMN_TYPE.split(' ')
      .slice(1)
      .map((modifier) => modifier.toUpperCase());

    return (
      this.kind.localeCompare(information['DATA_TYPE'], undefined, {
        sensitivity: 'base',
      }) === 0 &&
      this.modifiers.length === actualModifiers.length &&
      this.modifiers.every((modifier) => actualModifiers.includes(modifier))
    );
  }
}
