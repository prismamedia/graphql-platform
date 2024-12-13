import { Memoize } from '@prismamedia/memoize';
import type * as graphql from 'graphql';
import assert from 'node:assert';
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
  aggregateGraphError,
  castToError,
  GraphError,
  isGraphErrorWithPathEqualOrDescendantOf,
  UnexpectedValueError,
} from './error.js';
import { assertFunction } from './function.js';
import {
  ensureInputType,
  getGraphQLInputType,
  getOptionalInputType,
  InputType,
  isInputTypePublic,
  isNonOptionalInputType,
  nonNullableInputTypeDecorator,
  nonOptionalInputTypeDecorator,
  parseInputLiteral,
  parseInputValue,
  validateInputType,
} from './input/type.js';
import { addPath, type Path } from './path.js';
import { assertNillablePlainObject, type PlainObject } from './plain-object.js';
import { resolveThunkable, type Thunkable } from './thunkable.js';

export * from './input/type.js';

export type InputCustomParser<TValue = any> = (
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
  defaultValue?: Thunkable<TValue>;

  /**
   * Optional, add some custom validation or normalization on top of the "type"'s parser
   */
  parser?: InputCustomParser<TValue>;
}

export class Input<TValue = any> {
  public readonly name: string;
  public readonly description?: string;
  public readonly deprecationReason?: string;
  public readonly type: InputType;

  readonly #defaultValue?: Thunkable<TValue>;
  readonly #customParser?: InputCustomParser<TValue>;

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

      if (parserConfig) {
        assertFunction(parserConfig, parserConfigPath);

        this.#customParser = parserConfig;
      }
    }

    // default value
    {
      const defaultValueConfig = config.defaultValue;
      const defaultValueConfigPath = addPath(configPath, 'defaultValue');

      const defaultValue = resolveThunkable(defaultValueConfig);
      if (defaultValue !== undefined) {
        try {
          // Validates the provided "defaultValue" against the "type" and the custom-parser
          this.parseValue(defaultValue);
        } catch (error) {
          throw new UnexpectedValueError(
            [
              `to be valid against the type "${this.type}"`,
              this.#customParser && 'and the custom-parser',
            ]
              .filter(Boolean)
              .join(' '),
            defaultValue,
            { path: defaultValueConfigPath, cause: error },
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
    if (this.#isPublic !== undefined) {
      return this.#isPublic ?? false;
    } else {
      // We mark it as "null" to go through the circular dependencies (the test above will return "false")
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
      throw new UnexpectedValueError(
        `not to be "true" as "${this.type}" is private`,
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
    if (this.#isValid !== undefined) {
      return;
    } else {
      // We mark it as "null" to go through the circular dependencies
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
    return resolveThunkable(this.#defaultValue);
  }

  public parseValue(
    maybeValue: unknown = this.getDefaultValue(),
    path: Path = addPath(undefined, this.name, this.type),
    withCustomParser: boolean = true,
  ): TValue {
    const value = parseInputValue(this.type, maybeValue, path);

    if (value != null && this.#customParser && withCustomParser) {
      let customParsedValue: TValue;

      try {
        customParsedValue = this.#customParser(value, path);
      } catch (error) {
        throw isGraphErrorWithPathEqualOrDescendantOf(error, path)
          ? error
          : new GraphError(castToError(error).message, {
              cause: error,
              path,
            });
      }

      return this.parseValue(customParsedValue, path, false);
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

export function parseInputValues(
  inputs: ReadonlyArray<Input>,
  argumentOrObjectFields: unknown,
  path?: Path,
): PlainObject {
  assertNillablePlainObject(argumentOrObjectFields, path);

  /**
   * We keep the provided inputs' key here, in order to check
   * further if some extra have been provided
   */
  const inputKeySet = new Set(
    argumentOrObjectFields ? Object.keys(argumentOrObjectFields) : undefined,
  );

  const result = aggregateGraphError<Input, PlainObject>(
    inputs,
    (result, input) => {
      inputKeySet.delete(input.name);

      const parsedValue = input.parseValue(
        argumentOrObjectFields?.[input.name],
        addPath(path, input.name, input.type),
      );

      return parsedValue !== undefined
        ? Object.assign(result, { [input.name]: parsedValue })
        : result;
    },
    Object.create(null),
    { path },
  );

  if (inputKeySet.size > 0) {
    throw new GraphError(
      `Expects not to contain the extra key(s): ${[...inputKeySet].join(', ')}`,
      { path },
    );
  }

  return result;
}

export function parseInputLiterals(
  inputs: ReadonlyArray<Input>,
  argumentOrObjectFields:
    | ReadonlyArray<graphql.ArgumentNode | graphql.ObjectFieldNode>
    | undefined,
  variableValues?: graphql.GraphQLResolveInfo['variableValues'],
  path?: Path,
): PlainObject {
  /**
   * We keep the provided inputs' key here, in order to check
   * further if some extra have been provided
   */
  const inputKeySet = new Set(
    argumentOrObjectFields?.map(({ name }) => name.value),
  );

  const result = aggregateGraphError<Input, PlainObject>(
    inputs,
    (result, input) => {
      inputKeySet.delete(input.name);

      const maybeValue = argumentOrObjectFields?.find(
        ({ name }) => name.value === input.name,
      )?.value;

      const inputPath = addPath(path, input.name, input.type);

      const parsedValue = input.parseValue(
        maybeValue &&
          parseInputLiteral(input.type, maybeValue, variableValues, inputPath),
        inputPath,
      );

      return parsedValue !== undefined
        ? Object.assign(result, { [input.name]: parsedValue })
        : result;
    },
    Object.create(null),
    { path },
  );

  if (inputKeySet.size > 0) {
    throw new GraphError(
      `Expects not to contain the extra key(s): ${[...inputKeySet].join(', ')}`,
      { path },
    );
  }

  return result;
}
