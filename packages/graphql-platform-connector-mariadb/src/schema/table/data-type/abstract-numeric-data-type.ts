import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
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

    this.modifiers = [...new Set(config?.modifiers)].filter(
      // As it is the default, we don't need to specify it
      (modifier) => modifier !== 'SIGNED',
    );
  }

  public override isInformationValid(information: ColumnInformation): boolean {
    const actualModifiers = information.COLUMN_TYPE.split(' ').slice(1);

    return (
      super.isInformationValid(information) &&
      this.modifiers.length === actualModifiers.length &&
      this.modifiers.every((a) =>
        actualModifiers.some((b) => !utils.baseEnCollator.compare(a, b)),
      )
    );
  }
}
