import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';

export type AbstractDataTypeConfig<
  TKind extends string,
  TLeafValue extends NonNullable<core.LeafValue>,
  TColumnValue,
  TJsonValue = TColumnValue,
> = {
  kind: TKind;
  fromColumnValue?: (columnValue: TColumnValue) => TLeafValue;
  fromJsonValue?: (jsonValue: TJsonValue) => TLeafValue;
  toColumnValue?: (leafValue: TLeafValue) => TColumnValue;
};

export abstract class AbstractDataType<
  TKind extends string,
  TLeafValue extends NonNullable<core.LeafValue>,
  TColumnValue,
  TJsonValue = TColumnValue,
> {
  public readonly kind: TKind;
  public abstract readonly definition: string;
  readonly #serialize: (columnValue: TColumnValue) => string;
  readonly #fromColumnValue?: (columnValue: TColumnValue) => TLeafValue;
  readonly #fromJsonValue?: (jsonValue: TJsonValue) => TLeafValue;
  readonly #toColumnValue?: (leafValue: TLeafValue) => TColumnValue;

  public constructor(
    config: AbstractDataTypeConfig<
      TKind,
      TLeafValue,
      TColumnValue,
      TJsonValue
    > & {
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
    this.#fromJsonValue =
      config.fromJsonValue || (config.fromColumnValue as any);
    this.#toColumnValue = config.toColumnValue;
  }

  public toString(): string {
    return this.definition;
  }

  public fromColumnValue(columnValue: TColumnValue | null): TLeafValue | null {
    return columnValue !== null && this.#fromColumnValue
      ? this.#fromColumnValue(columnValue)
      : (columnValue as any);
  }

  public fromJsonValue(jsonValue: TJsonValue | null): TLeafValue | null {
    return jsonValue !== null && this.#fromJsonValue
      ? this.#fromJsonValue(jsonValue)
      : (jsonValue as any);
  }

  public toColumnValue(leafValue: TLeafValue | null): TColumnValue | null {
    return leafValue !== null && this.#toColumnValue
      ? this.#toColumnValue(leafValue)
      : (leafValue as any);
  }

  public serialize(leafValue: TLeafValue | null): string {
    const columnValue: TColumnValue | null = this.toColumnValue(leafValue);

    return columnValue !== null ? this.#serialize(columnValue) : 'NULL';
  }
}
