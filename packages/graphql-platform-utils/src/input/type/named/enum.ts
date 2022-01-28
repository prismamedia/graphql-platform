import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import {
  getOptionalDeprecation,
  getOptionalDescription,
  getOptionalFlag,
  Name,
  OptionalDeprecation,
  OptionalDescription,
  OptionalFlag,
} from '../../../config.js';
import {
  aggregateConfigError,
  castToError,
  UnexpectedConfigError,
  UnexpectedValueError,
} from '../../../error.js';
import { isNil, Nillable } from '../../../nil.js';
import { addPath, Path } from '../../../path.js';
import { resolveThunkOrValue, ThunkOrValue } from '../../../thunk-or-value.js';
import {
  AbstractNamedInputType,
  AbstractNamedInputTypeConfig,
} from './abstract.js';

export type EnumInputValueConfig = {
  /**
   * Required, the value
   */
  value: string;

  /**
   * Optional, this value's visibility
   *
   * Default: true
   */
  public?: OptionalFlag;

  /**
   * Optional, its name in the GraphQL API
   *
   * Default: its value
   */
  name?: Name | null;

  /**
   * Optional, provide a description
   */
  description?: OptionalDescription;

  /**
   * Optional, either this input is deprecated or not
   */
  deprecated?: OptionalDeprecation;
};

export class EnumInputValue {
  public readonly value: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public constructor(
    public readonly config: EnumInputValueConfig,
    public readonly configPath?: Path,
  ) {
    // value
    {
      const valueConfig = config.value;
      const valueConfigPath = addPath(configPath, 'value');

      if (typeof valueConfig !== 'string' || !valueConfig) {
        throw new UnexpectedConfigError(`a non-empty string`, valueConfig, {
          path: valueConfigPath,
        });
      }

      if (config.name == null) {
        try {
          this.name = graphql.assertEnumValueName(valueConfig);
        } catch (error) {
          throw new UnexpectedConfigError(
            'to be valid against the GraphQL "EnumValue" specification (@see: https://spec.graphql.org/draft/#EnumValue)',
            valueConfig,
            { path: valueConfigPath, cause: castToError(error) },
          );
        }
      }

      this.value = valueConfig;
    }

    // name
    {
      const nameConfig = config.name;
      const nameConfigPath = addPath(configPath, 'name');

      if (nameConfig == null) {
        this.name = this.value;
      } else {
        if (typeof nameConfig !== 'string' || !nameConfig) {
          throw new UnexpectedConfigError(`a non-empty string`, nameConfig, {
            path: nameConfigPath,
          });
        }

        try {
          this.name = graphql.assertEnumValueName(nameConfig);
        } catch (error) {
          throw new UnexpectedConfigError(
            'to be valid against the GraphQL "EnumValue"\'s name specification (@see: https://spec.graphql.org/draft/#EnumValue)',
            nameConfig,
            { path: nameConfigPath, cause: castToError(error) },
          );
        }
      }
    }

    // description
    {
      const descriptionConfig = config.description;
      const descriptionConfigPath = addPath(configPath, 'description');

      this.description = getOptionalDescription(
        descriptionConfig,
        descriptionConfigPath,
      );
    }

    // deprecated
    {
      const deprecatedConfig = config.deprecated;
      const deprecatedConfigPath = addPath(configPath, 'deprecated');

      this.deprecationReason = getOptionalDeprecation(
        deprecatedConfig,
        `"${this.name}" is deprecated`,
        deprecatedConfigPath,
      );
    }
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isPublic(): boolean {
    const publicConfig = this.config.public;
    const publicConfigPath = addPath(this.configPath, 'public');

    return getOptionalFlag(publicConfig, true, publicConfigPath);
  }

  public getGraphQLEnumValueConfig(): graphql.GraphQLEnumValueConfig {
    assert(this.isPublic(), `"${this.name}" is private`);

    return {
      value: this.value,
      ...(this.description && {
        description: this.description,
      }),
      ...(this.deprecationReason && {
        deprecationReason: this.deprecationReason,
      }),
    };
  }

  @Memoize()
  public validate(): void {
    if (this.isPublic()) {
      this.getGraphQLEnumValueConfig();
    }
  }
}

export interface EnumInputTypeConfig<
  TValue extends EnumInputValue = EnumInputValue,
> extends AbstractNamedInputTypeConfig {
  values?: ThunkOrValue<TValue[]>;
}

export class EnumInputType<
  TValue extends EnumInputValue = EnumInputValue,
> extends AbstractNamedInputType<string> {
  readonly #valuesConfig: EnumInputTypeConfig<TValue>['values'];
  readonly #valuesConfigPath: Path;

  public constructor(
    { values, ...config }: EnumInputTypeConfig<TValue>,
    configPath: Path = addPath(undefined, config.name),
  ) {
    super(config, configPath);

    this.#valuesConfig = values;
    this.#valuesConfigPath = addPath(configPath, 'values');
  }

  @Memoize()
  public get enumValues(): ReadonlyArray<TValue> {
    const values = resolveThunkOrValue(this.#valuesConfig);

    return Object.freeze(
      values?.length
        ? aggregateConfigError<TValue, TValue[]>(
            values,
            (values, value, index) => {
              if (!(value instanceof EnumInputValue)) {
                throw new UnexpectedConfigError(`an enum input value`, value, {
                  path: addPath(this.#valuesConfigPath, index),
                });
              }

              return [...values, value];
            },
            [],
            { path: this.#valuesConfigPath },
          )
        : [],
    );
  }

  @Memoize()
  public get enumValuesByValue(): ReadonlyMap<TValue['value'], TValue> {
    return new Map(
      this.enumValues.map((enumValue) => [enumValue.value, enumValue]),
    );
  }

  @Memoize()
  public get publicEnumValuesByValue(): ReadonlyMap<TValue['value'], TValue> {
    return new Map(
      aggregateConfigError<TValue, [TValue['value'], TValue][]>(
        this.enumValuesByValue.values(),
        (entries, value) =>
          value.isPublic() ? [...entries, [value.value, value]] : entries,
        [],
        { path: this.#valuesConfigPath },
      ),
    );
  }

  @Memoize()
  public override isPublic(): boolean {
    return this.publicEnumValuesByValue.size > 0;
  }

  @Memoize()
  public override getGraphQLInputType(): graphql.GraphQLEnumType {
    assert(this.isPublic(), `The "${this}" input type is private`);

    return new graphql.GraphQLEnumType({
      name: this.name,
      ...(this.description && { description: this.description }),
      values: Object.fromEntries(
        Array.from(this.publicEnumValuesByValue.values(), (value) => [
          value.name,
          value.getGraphQLEnumValueConfig(),
        ]),
      ),
    });
  }

  @Memoize()
  public override validate(): void {
    aggregateConfigError<TValue, void>(
      this.enumValuesByValue.values(),
      (_, value) => value.validate(),
      undefined,
      { path: this.#valuesConfigPath },
    );

    this.publicEnumValuesByValue;

    if (this.isPublic()) {
      this.getGraphQLInputType();
    }
  }

  public getEnumValue(value: unknown, path?: Path): TValue {
    const enumValue = this.enumValuesByValue.get(value as any);
    if (!enumValue) {
      throw new UnexpectedValueError(
        `a value among "${[...this.enumValuesByValue.keys()].join(', ')}"`,
        value,
        { path },
      );
    }

    return enumValue;
  }

  public parseValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.name),
  ): Nillable<TValue['value']> {
    if (isNil(maybeValue)) {
      return maybeValue;
    }

    return this.getEnumValue(maybeValue, path).value;
  }
}
