import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidName,
  GraphQLInputFieldConfig,
  GraphQLInputType,
  isInputType,
} from 'graphql';
import { UnexpectedValueError } from './errors';
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
import { getOptionalFlag, OptionalFlag } from './optional-flag';
import { addPath, Path } from './path';
import { resolveThunkOrValue, ThunkOrValue } from './thunk-or-value';

export interface AbstractFieldConfig {
  /**
   * Optional, provide a description
   */
  readonly description?: string;

  /**
   * Optional, either this field is public or not
   *
   * Default: the parent's visibility
   */
  readonly public?: OptionalFlag;
}

export abstract class AbstractField implements NameAware, VisibilityAware {
  public readonly name: string;
  public readonly id: string;
  public readonly description: string | undefined;
  public readonly public: boolean;

  public constructor(
    parent: NameAware & VisibilityAware,
    name: string,
    config?: AbstractFieldConfig,
  ) {
    this.name = assertValidName(name);
    this.id = `${parent.name}.${this.name}`;
    this.description = config?.description || undefined;

    this.public = getOptionalFlag(config?.public, parent.public);
    assert(
      !this.public || parent.public,
      `The "${this}" field cannot be public as "${parent.name}" is not`,
    );
  }

  public toString(): string {
    return this.id;
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
  readonly nullable?: OptionalFlag;

  /**
   * Optional, a default value for this field
   */
  readonly defaultValue?: TValue;

  /**
   * Optional, either the value has to be provided (!= undefined) or not
   *
   * Default: !nullable
   */
  readonly required?: OptionalFlag;

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
    this.#nullable = getOptionalFlag(nullable, true);
    this.#defaultValue = defaultValue;
    this.#required = getOptionalFlag(required, !this.#nullable);
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
      type: GraphQLNonNullDecorator(
        resolveThunkOrValue(this.#type),
        this.required && !this.#nullable,
      ),
      description: this.description,
      defaultValue: this.defaultValue,
    };
  }

  public assertValue(
    value: unknown = this.defaultValue,
    path?: Path,
  ): TValue | undefined {
    if (value === undefined) {
      if (this.#required) {
        throw new UnexpectedValueError(
          value,
          `a "${isInputType(this.#type) ? String(this.#type) : 'value'}"`,
          path,
        );
      }

      return value;
    } else if (value === null) {
      if (!this.#nullable) {
        throw new UnexpectedValueError(
          value,
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
    throw new UnexpectedValueError(
      maybeObject,
      `a nullish value or a plain object`,
      path,
    );
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
