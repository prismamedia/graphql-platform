import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import {
  assertOptionalFlag,
  ensureName,
  getOptionalDeprecation,
  getOptionalDescription,
  getOptionalFlag,
  type Name,
  type OptionalDeprecation,
  type OptionalDescription,
  type OptionalFlag,
} from './config.js';
import {
  aggregateError,
  castToError,
  isNestableError,
  NestableError,
  UnexpectedConfigError,
  UnexpectedValueError,
} from './error.js';
import {
  ensureInputType,
  getGraphQLInputType,
  getOptionalInputType,
  InputType,
  isInputTypePublic,
  isNonOptionalInputType,
  nonNullableInputTypeDecorator,
  nonOptionalInputTypeDecorator,
  parseInputValue,
  validateInputType,
} from './input/type.js';
import { addPath, type Path } from './path.js';
import { isPlainObject, type PlainObject } from './plain-object.js';
import { resolveThunkOrValue, type ThunkOrValue } from './thunk-or-value.js';

export * from './input/type.js';

export type InputParser<TValue = any> = (
  value: NonNullable<TValue>,
  path: Path,
) => TValue;

export interface InputConfig<TValue = any> {
  /**
   * Required, this input's name
   */
  name: Name;

  /**
   * Optional, provide a description
   */
  description?: OptionalDescription;

  /**
   * Optional, either this input is deprecated or not
   */
  deprecated?: OptionalDeprecation;

  /**
   * Optional, either "undefined" is allowed or not
   */
  optional?: OptionalFlag;

  /**
   * Optional, either "null" is allowed or not
   */
  nullable?: OptionalFlag;

  /**
   * Required, this input's type
   */
  type: InputType;

  /**
   * Optional, this input's visibility
   *
   * Default: its type's visibility
   */
  public?: OptionalFlag;

  /**
   * Optional, a different type can be provided for the GraphQL Schema
   *
   * Default: the "type" above
   */
  publicType?: InputType;

  /**
   * Optional, a default value for this field if none have been provided (= "undefined")
   *
   * Unlike the GraphQL "DefaultValue", it can be provided as a "thunk" (= a function without paramater)
   *
   * @see https://spec.graphql.org/draft/#DefaultValue
   */
  defaultValue?: ThunkOrValue<TValue>;

  /**
   * Optional, add some custom validation or normalization
   */
  parser?: InputParser<TValue> | null;
}

export class Input<TValue = any> {
  public readonly name: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public readonly type: InputType;

  readonly #defaultValue?: ThunkOrValue<TValue>;
  readonly #parser?: InputParser<TValue>;

  #isPublic?: null | boolean;
  #isValid?: null | true;

  public constructor(
    public readonly config: InputConfig<TValue>,
    public readonly configPath: Path = addPath(undefined, config.name),
  ) {
    // name
    {
      const nameConfig = config.name;
      const nameConfigPath = addPath(configPath, 'name');

      this.name = ensureName(nameConfig, nameConfigPath);
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

    // type
    {
      const optionalConfig = config.optional;
      const optionalConfigPath = addPath(configPath, 'optional');

      assertOptionalFlag(optionalConfig, optionalConfigPath);

      const nullableConfig = config.nullable;
      const nullableConfigPath = addPath(configPath, 'nullable');

      assertOptionalFlag(nullableConfig, nullableConfigPath);

      const typeConfig = config.type;
      const typeConfigPath = addPath(configPath, 'type');

      let type = ensureInputType(typeConfig, typeConfigPath);

      type =
        optionalConfig == null
          ? type
          : nonOptionalInputTypeDecorator(type, !optionalConfig);

      type =
        nullableConfig == null
          ? type
          : nonNullableInputTypeDecorator(type, !nullableConfig);

      this.type = type;
    }

    // parser
    {
      const parserConfig = config.parser;
      const parserConfigPath = addPath(configPath, 'parser');

      if (parserConfig != null && typeof parserConfig !== 'function') {
        throw new UnexpectedConfigError(`a function`, parserConfig, {
          path: parserConfigPath,
        });
      }

      this.#parser = parserConfig || undefined;
    }

    // default value
    {
      const defaultValueConfig = config.defaultValue;
      const defaultValueConfigPath = addPath(configPath, 'defaultValue');

      const defaultValue = resolveThunkOrValue(defaultValueConfig);
      if (defaultValue !== undefined) {
        try {
          // Validates the provided "defaultValue" against the "type" and the custom validation
          this.parseValue(defaultValue);
        } catch (error) {
          throw new UnexpectedConfigError(
            `to be valid against the type "${this.type}" and the custom validation`,
            defaultValue,
            {
              path: defaultValueConfigPath,
              cause: castToError(error),
            },
          );
        }

        this.#defaultValue = defaultValueConfig;
      }
    }
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isRequired(): boolean {
    return (
      this.#defaultValue === undefined && isNonOptionalInputType(this.type)
    );
  }

  public isPublic(): boolean {
    if (typeof this.#isPublic !== 'undefined') {
      return this.#isPublic ?? false;
    } else {
      this.#isPublic = null;
    }

    const isTypePublic = isInputTypePublic(this.type);

    const publicConfig = this.config.public;
    const publicConfigPath = addPath(this.configPath, 'public');

    this.#isPublic = getOptionalFlag(
      publicConfig,
      isTypePublic,
      publicConfigPath,
    );

    if (this.#isPublic && !isTypePublic) {
      throw new UnexpectedConfigError(
        `not to be true as "${this.type}" is private`,
        publicConfig,
        { path: publicConfigPath },
      );
    }

    return this.#isPublic;
  }

  @Memoize()
  public getGraphQLConfig(): Omit<
    graphql.GraphQLArgumentConfig | graphql.GraphQLInputFieldConfig,
    'extensions'
  > {
    assert(this.isPublic(), `The "${this}" input field is private`);

    const publicTypeConfig = this.config.publicType;
    const publicTypeConfigPath = addPath(this.configPath, 'publicType');

    let publicType =
      publicTypeConfig != null
        ? ensureInputType(publicTypeConfig, publicTypeConfigPath)
        : this.type;

    let staticDefaultValue: unknown;

    if (typeof this.#defaultValue === 'function') {
      publicType = getOptionalInputType(publicType);
    } else {
      staticDefaultValue = this.#defaultValue;
    }

    return {
      type: getGraphQLInputType(publicType),
      ...(this.description && { description: this.description }),
      ...(this.deprecationReason && {
        deprecationReason: this.deprecationReason,
      }),
      ...(staticDefaultValue !== undefined && {
        defaultValue: staticDefaultValue,
      }),
    };
  }

  public validate(): void {
    if (typeof this.#isValid !== 'undefined') {
      return;
    } else {
      this.#isValid = null;
    }

    validateInputType(this.type);

    this.isRequired();

    if (this.isPublic()) {
      this.getGraphQLConfig();
    }

    this.#isValid = true;
  }

  public getDefaultValue(): TValue | undefined {
    return resolveThunkOrValue(this.#defaultValue);
  }

  public parseValue(
    maybeValue: unknown = this.getDefaultValue(),
    path: Path = addPath(undefined, this.name, this.type),
  ): TValue {
    const value = parseInputValue(this.type, maybeValue, path);

    if (value != null && this.#parser) {
      let customValue: unknown;
      try {
        customValue = this.#parser(value, path);
      } catch (error) {
        throw isNestableError(error)
          ? error
          : new NestableError(castToError(error).message, { path });
      }

      return parseInputValue(this.type, customValue, path);
    }

    return value;
  }
}

export const getGraphQLFieldConfigArgumentMap = (
  inputs: Iterable<Input>,
): graphql.GraphQLFieldConfigArgumentMap =>
  Object.fromEntries<graphql.GraphQLArgumentConfig>(
    Array.from(inputs)
      .filter((input) => {
        assert(
          !input.isRequired() || input.isPublic(),
          `The "${input}" argument is required but is not public`,
        );

        return input.isPublic();
      })
      .map((argument) => [argument.name, argument.getGraphQLConfig()]),
  );

export function parseInputs(
  inputs: Iterable<Input>,
  maybeInputsValues: unknown,
  path?: Path,
): PlainObject {
  if (maybeInputsValues != null && !isPlainObject(maybeInputsValues)) {
    throw new UnexpectedValueError(`a plain-object`, maybeInputsValues, {
      path,
    });
  }

  /**
   * We keep the provided object's keys here, in order to check
   * further if some extra have been provided
   */
  const extraKeySet = new Set(
    maybeInputsValues ? Object.keys(maybeInputsValues) : [],
  );

  const result = aggregateError<Input, PlainObject>(
    inputs,
    (result, input) => {
      extraKeySet.delete(input.name);

      const parsedValue = input.parseValue(
        maybeInputsValues?.[input.name],
        addPath(path, input.name, input.type),
      );

      return parsedValue !== undefined
        ? Object.assign(result, { [input.name]: parsedValue })
        : result;
    },
    Object.create(null),
    { path },
  );

  if (extraKeySet.size > 0) {
    throw new NestableError(
      `Expects not to contain the extra key(s): ${[...extraKeySet].join(', ')}`,
      { path },
    );
  }

  return result;
}
