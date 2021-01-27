import assert from 'assert';
import {
  assertValidName,
  GraphQLArgumentConfig,
  GraphQLInputFieldConfig,
} from 'graphql';
import { getOptionalFlag, OptionalFlag } from '../optional-flag';
import { addPath, Path } from '../path';
import { resolveThunkOrValue, ThunkOrValue } from '../thunk-or-value';
import { assertInputValue, getGraphQLInputType, InputType } from './type';
import {
  isNonOptionalInputType,
  NonNullableInputTypeDecorator,
  NonOptionalInputTypeDecorator,
} from './type/wrapping';

export type InputFieldValueAssertion<TValue = any> = (
  value: TValue,
  path?: Path,
) => TValue;

export interface InputFieldConfig<TValue = any> {
  /**
   * Required, this input's name
   */
  name: string;

  /**
   * Optional, this input's visibility
   *
   * Default: true
   */
  public?: OptionalFlag;

  /**
   * Optional, provide a description
   */
  description?: string;

  /**
   * Optional, either this input is deprecated or not
   */
  deprecated?: boolean | string;

  /**
   * Required, this input's type
   */
  type: InputType;

  /**
   * Optional, either "undefined" is allowed or not
   *
   * GraphQL makes no difference between "!= null" and "!= undefined": a "GraphQLNonNull" field must be "!= null" AND "!= undefined"
   * By default, we keep that behavior but let the user choose otherwise
   */
  optional?: OptionalFlag;

  /**
   * Optional, either "null" is allowed or not
   */
  nullable?: OptionalFlag;

  /**
   * Optional, a default value for this field if none have been provided (= "undefined")
   *
   * Unlike the GraphQL "DefaultValue", it can be provided as a "thunk" (= a function without paramater)
   *
   * @see https://spec.graphql.org/draft/#DefaultValue
   */
  defaultValue?: ThunkOrValue<TValue>;

  /**
   * Optional, add a validation layer on top of the "type"'s one
   */
  assertValue?: InputFieldValueAssertion<TValue>;
}

export class InputField<TValue = any> {
  public readonly name: string;
  public readonly public: boolean;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;
  public readonly type: InputType;
  public readonly required: boolean;

  readonly #defaultValue: InputFieldConfig<TValue>['defaultValue'];
  readonly #assertValue: InputFieldConfig<TValue>['assertValue'];

  public constructor(config: InputFieldConfig<TValue>) {
    this.name = assertValidName(config.name);
    this.public = getOptionalFlag(config.public, true);
    this.description = config.description || undefined;
    this.deprecationReason =
      config.deprecated === true
        ? `"${this.name}" is deprecated`
        : config.deprecated || undefined;

    this.#defaultValue = config.defaultValue;
    this.#assertValue = config.assertValue;

    let type = config.type;

    if (typeof config.optional === 'boolean') {
      type = NonOptionalInputTypeDecorator(type, !config.optional);
    }

    if (typeof config.nullable === 'boolean') {
      type = NonNullableInputTypeDecorator(type, !config.nullable);
    }

    this.type = type;

    const defaultValue = this.getDefaultValue();
    if (defaultValue !== undefined) {
      // Ensure the provided "defaultValue" is valid
      assertInputValue(
        this.type,
        defaultValue,
        addPath(addPath(undefined, this.name), 'defaultValue'),
      );

      this.required = false;
    } else {
      this.required = isNonOptionalInputType(this.type);
    }
  }

  public toString(): string {
    return this.name;
  }

  public get graphql(): Pick<
    GraphQLArgumentConfig & GraphQLInputFieldConfig,
    'type' | 'description' | 'deprecationReason' | 'defaultValue'
  > {
    assert(this.public, `"${this.name}" is private`);

    return {
      type: getGraphQLInputType(this.type),
      ...(this.description !== undefined && { description: this.description }),
      ...(this.deprecationReason !== undefined && {
        deprecationReason: this.deprecationReason,
      }),
      ...(this.#defaultValue !== undefined &&
        typeof this.#defaultValue !== 'function' && {
          defaultValue: this.#defaultValue,
        }),
    };
  }

  public getDefaultValue(): TValue | undefined {
    return resolveThunkOrValue(this.#defaultValue);
  }

  public assertValue(
    maybeValue: unknown = this.getDefaultValue(),
    path?: Path,
  ): TValue {
    const value = assertInputValue<TValue>(this.type, maybeValue, path);

    return this.#assertValue ? this.#assertValue(value, path) : value;
  }
}
