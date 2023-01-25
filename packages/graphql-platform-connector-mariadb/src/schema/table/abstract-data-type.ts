import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { ColumnInformation } from '../../statement.js';

export interface AbstractDataTypeConfig<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> {
  kind: TKind;
  parser?: (value: NonNullable<TValue>) => TLeafValue | null;
  serializer?: (value: NonNullable<TLeafValue>) => TValue | null;
}

export abstract class AbstractDataType<
  TKind extends string,
  TLeafValue extends core.LeafValue,
  TValue,
> {
  public readonly kind: TKind;
  public abstract readonly definition: string;

  readonly #parser?: (value: NonNullable<TValue>) => TLeafValue | null;
  readonly #serializer?: (value: NonNullable<TLeafValue>) => TValue | null;

  public constructor(
    config: AbstractDataTypeConfig<TKind, TLeafValue, TValue>,
    configPath?: utils.Path,
  ) {
    // kind
    {
      const kindConfig = config.kind;
      const kindConfigPath = utils.addPath(configPath, 'kind');

      if (typeof kindConfig !== 'string' || !kindConfig) {
        throw new utils.UnexpectedValueError('a string', kindConfig, {
          path: kindConfigPath,
        });
      }

      this.kind = config.kind;
    }

    this.#parser = config.parser;
    this.#serializer = config.serializer;
  }

  public toString(): string {
    return this.definition;
  }

  protected doParseColumnValue(columnValue: unknown): TValue | null {
    return columnValue as any;
  }

  public parseColumnValue(columnValue: unknown): TLeafValue | null {
    if (columnValue != null) {
      const value = this.doParseColumnValue(columnValue);
      if (value != null) {
        return this.#parser ? this.#parser(value) : (value as any);
      }
    }

    return null;
  }

  protected doParseJsonValue(jsonValue: unknown): TValue | null {
    return this.doParseColumnValue(jsonValue);
  }

  public parseJsonValue(jsonValue: unknown): TLeafValue | null {
    if (jsonValue != null) {
      const value = this.doParseJsonValue(jsonValue);
      if (value != null) {
        return this.#parser ? this.#parser(value) : (value as any);
      }
    }

    return null;
  }

  protected abstract doSerialize(value: TValue): string;

  public serialize(leafValue: TLeafValue | null): string {
    if (leafValue != null) {
      const value = this.#serializer
        ? this.#serializer(leafValue)
        : (leafValue as any);

      if (value != null) {
        return this.doSerialize(value);
      }
    }

    return 'NULL';
  }

  public isInformationValid(
    information: ColumnInformation['DATA_TYPE'],
  ): boolean {
    return (
      this.kind.localeCompare(information, undefined, {
        sensitivity: 'base',
      }) === 0
    );
  }
}
