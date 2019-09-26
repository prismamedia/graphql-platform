import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidName,
  GraphQLInputFieldConfig,
  GraphQLInputType,
  isInputType,
} from 'graphql';
import {
  getOptionalFlagValue,
  OptionalFlagValue,
  resolveThunkOrValue,
  ThunkOrValue,
} from '.';
import {
  UnexpectedNullValueError,
  UnexpectedUndefinedValueError,
  UnexpectedValueError,
} from './errors';
import {
  assertWrappedLeafValue,
  GraphQLNonNullDecorator,
  isWrappedLeafType,
} from './graphql';
import {
  isPlainObject,
  NameAware,
  PlainObject,
  VisibilityAware,
} from './object';
import { addPath, Path } from './path';

export interface AbstractFieldConfig {
  /**
   * Optional, provide a description
   */
  readonly description?: ThunkOrValue<string | undefined>;

  /**
   * Optional, either this field is public or not
   *
   * Default: the parent's visibility
   */
  readonly public?: ThunkOrValue<OptionalFlagValue>;
}

export abstract class AbstractField implements NameAware, VisibilityAware {
  readonly #parent: NameAware & VisibilityAware;
  public readonly name: string;
  public readonly id: string;
  readonly #description: AbstractFieldConfig['description'];
  readonly #public: AbstractFieldConfig['public'];

  public constructor(
    parent: NameAware & VisibilityAware,
    name: string,
    config?: AbstractFieldConfig,
  ) {
    this.#parent = parent;
    this.name = assertValidName(name);
    this.id = `${parent.name}.${this.name}`;
    this.#description = config?.description;
    this.#public = config?.public;
  }

  public toString(): string {
    return this.id;
  }

  @Memoize()
  public get description(): string | undefined {
    return resolveThunkOrValue(this.#description);
  }

  @Memoize()
  public get public(): boolean {
    const isPublic = getOptionalFlagValue(
      resolveThunkOrValue(this.#public),
      this.#parent.public,
    );

    assert(
      !isPublic || this.#parent.public,
      `The "${this.id}" field cannot be public as "${
        this.#parent.name
      }" is not`,
    );

    return isPublic;
  }
}

export interface InputFieldConfig<TValue = unknown>
  extends AbstractFieldConfig {
  /**
   * Required, this field's type
   */
  readonly type: ThunkOrValue<GraphQLInputType>;

  /**
   * Optional, either the provided value can be null or not
   */
  readonly nullable?: OptionalFlagValue;

  /**
   * Optional, a default value for this field
   */
  readonly defaultValue?: TValue;

  /**
   * Optional, either the value has to be provided (!= undefined) or not
   *
   * Default: !nullable
   */
  readonly required?: OptionalFlagValue;

  /**
   * Optional, a function used to assert the provided value is valid
   */
  assertValue?(value: unknown, path?: Path): TValue;
}

export class InputField<TValue = unknown> extends AbstractField {
  readonly #type: InputFieldConfig<TValue>['type'];
  readonly #nullable: boolean;
  readonly #defaultValue?: TValue;
  readonly #required: boolean;
  readonly #assertValue?: (value: unknown, path?: Path) => TValue;

  public constructor(
    parent: NameAware & VisibilityAware,
    name: string,
    {
      type,
      nullable,
      defaultValue,
      required,
      assertValue,
      ...config
    }: InputFieldConfig<TValue>,
  ) {
    super(parent, name, config);

    this.#type = type;
    this.#nullable = getOptionalFlagValue(nullable, true);
    this.#defaultValue = defaultValue;
    this.#required = getOptionalFlagValue(required, !this.#nullable);
    this.#assertValue = assertValue
      ? assertValue
      : isWrappedLeafType(type)
      ? assertWrappedLeafValue.bind(undefined, type)
      : undefined;
  }

  @Memoize()
  public get defaultValue(): TValue | undefined {
    return this.#defaultValue !== undefined
      ? this.assertValue(this.#defaultValue)
      : undefined;
  }

  @Memoize()
  public get required(): boolean {
    return this.#required && this.defaultValue === undefined;
  }

  @Memoize()
  public get graphqlInputFieldConfig(): GraphQLInputFieldConfig {
    assert(this.public, `"${this.id} is private`);

    return {
      description: this.description,
      type: GraphQLNonNullDecorator(
        resolveThunkOrValue(this.#type),
        this.required && !this.#nullable,
      ),
      defaultValue: this.defaultValue,
    };
  }

  public assertValue(
    value: unknown = this.defaultValue,
    path?: Path,
  ): TValue | undefined {
    if (value === undefined) {
      if (this.#required) {
        throw new UnexpectedUndefinedValueError(
          `a "${isInputType(this.#type) ? String(this.#type) : 'value'}"`,
          path,
        );
      }

      return value;
    } else if (value === null) {
      if (!this.#nullable) {
        throw new UnexpectedNullValueError(
          `a non-null "${
            isInputType(this.#type) ? String(this.#type) : 'value'
          }"`,
          path,
        );
      }

      return value as any;
    }

    return this.#assertValue ? this.#assertValue(value, path) : (value as any);
  }
}

export const isRequiredInputEntry = (entry: [string, InputField]) =>
  entry[1].required;

export const hasRequiredInputField = (fields: Iterable<InputField>) =>
  [...fields].some((field) => field.required);

export function assertInputObject(
  maybeObject: unknown,
  fields: Iterable<InputField>,
  path?: Path,
): PlainObject | undefined {
  if (
    !(
      maybeObject === undefined ||
      maybeObject === null ||
      isPlainObject(maybeObject)
    )
  ) {
    throw new UnexpectedValueError(maybeObject, `nothing or an object`, path);
  }

  /**
   * We keep the provided object's keys here, in order to check
   * further if some extra have been provided
   */
  const maybeObjectKeySet = maybeObject
    ? new Set(Object.keys(maybeObject))
    : undefined;

  const assertedObject = [...fields].reduce(
    (object: PlainObject | undefined, field) => {
      maybeObjectKeySet?.delete(field.name);

      const fieldValue = field.assertValue(
        maybeObject?.[field.name],
        addPath(path, field.name),
      );

      return fieldValue !== undefined
        ? { ...object, [field.name]: fieldValue }
        : object;
    },
    undefined,
  );

  if (maybeObjectKeySet?.size) {
    throw new UnexpectedValueError(
      maybeObject,
      `not to contain the extra field(s) "${[...maybeObjectKeySet].join(
        ', ',
      )}"`,
      path,
    );
  }

  return assertedObject;
}
