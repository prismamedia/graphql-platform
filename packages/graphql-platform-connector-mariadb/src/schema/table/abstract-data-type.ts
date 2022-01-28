import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';

export type AbstractDataTypeConfig<
  TKind extends string,
  TColumnValue,
  TLeafValue extends core.LeafValue,
> = {
  kind: TKind;
  fromColumnValue?: (columnValue: TColumnValue) => TLeafValue;
  toColumnValue?: (leafValue: TLeafValue) => TColumnValue;
};

export abstract class AbstractDataType<
  TKind extends string,
  TColumnValue,
  TLeafValue extends core.LeafValue,
> {
  public readonly kind: TKind;
  readonly #serialize: (columnValue: TColumnValue) => string;
  readonly #fromColumnValue?: (columnValue: TColumnValue) => TLeafValue;
  readonly #toColumnValue?: (leafValue: TLeafValue) => TColumnValue;

  public constructor(
    config: AbstractDataTypeConfig<TKind, TColumnValue, TLeafValue> & {
      serialize: (columnValue: TColumnValue) => string;
    },
    configPath?: utils.Path,
  ) {
    // kind
    {
      const kindConfig = config.kind;
      const kindConfigPath = utils.addPath(configPath, 'kind');

      if (typeof kindConfig !== 'string' || !kindConfig) {
        throw new utils.UnexpectedConfigError('a string', kindConfig, {
          path: kindConfigPath,
        });
      }

      this.kind = config.kind;
    }

    this.#serialize = config.serialize;
    this.#fromColumnValue = config.fromColumnValue;
    this.#toColumnValue = config.toColumnValue;
  }

  public get definition(): string {
    return this.kind;
  }

  public toString(): string {
    return this.definition;
  }

  public fromColumnValue(columnValue: TColumnValue | null): TLeafValue | null {
    return columnValue !== null && this.#fromColumnValue
      ? this.#fromColumnValue(columnValue)
      : (columnValue as TLeafValue | null);
  }

  public toColumnValue(leafValue: TLeafValue | null): TColumnValue | null {
    return leafValue !== null && this.#toColumnValue
      ? this.#toColumnValue(leafValue)
      : (leafValue as TColumnValue | null);
  }

  public serialize(columnValue: TColumnValue | null): string {
    return columnValue !== null ? this.#serialize(columnValue) : 'NULL';
  }
}
