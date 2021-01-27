import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  assertValidName,
  GraphQLEnumType,
  GraphQLEnumValueConfig,
} from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { Except } from 'type-fest';
import { UnexpectedValueError, UnreachableValueError } from '../../../errors';
import { assertGraphQLEnumValue } from '../../../graphql';
import { isIterableObject } from '../../../iterable';
import { isPlainObject } from '../../../object';
import { getOptionalFlag, OptionalFlag } from '../../../optional-flag';
import { Path } from '../../../path';
import {
  AbstractNamedInputType,
  AbstractNamedInputTypeConfig,
} from './abstract';

export type InputEnumValueConfig = {
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
   * Default: the value
   */
  name?: Maybe<string>;

  /**
   * Optional, provide a description
   */
  description?: Maybe<string>;

  /**
   * Optional, either this input is deprecated or not
   */
  deprecated?: boolean | string;
};

export class InputEnumValue {
  public readonly value: string;
  public readonly public: boolean;
  public readonly name: string;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;

  public constructor(config: InputEnumValueConfig) {
    if (typeof config.value !== 'string') {
      throw new UnexpectedValueError(config.value, `a string`);
    }

    this.value = config.value;
    this.public = getOptionalFlag(config.public, true);
    this.name = assertValidName(config.name || this.value);
    this.description = config.description || undefined;
    this.deprecationReason =
      config.deprecated === true
        ? `"${this.name}" is deprecated`
        : config.deprecated || undefined;
  }
}

export interface InputEnumTypeConfig extends AbstractNamedInputTypeConfig {
  values:
    | { [value: string]: Except<InputEnumValueConfig, 'value'> }
    | Iterable<InputEnumValueConfig['value'] | InputEnumValueConfig>;
}

export class InputEnumType extends AbstractNamedInputType {
  public readonly valueMap: ReadonlyMap<
    InputEnumValue['value'],
    InputEnumValue
  >;

  public readonly publicValueMap: ReadonlyMap<
    InputEnumValue['value'],
    InputEnumValue
  >;

  public readonly values: ReadonlyArray<InputEnumValue['value']>;

  public constructor(config: InputEnumTypeConfig) {
    super(config);

    const valueConfigs: InputEnumValueConfig[] = isPlainObject(config.values)
      ? Object.entries(config.values).map(([value, config]) => ({
          value,
          ...config,
        }))
      : isIterableObject(config.values)
      ? Array.from(config.values, (value) =>
          isPlainObject(value) ? value : { value },
        )
      : [];

    this.valueMap = new Map(
      valueConfigs.map((config) => {
        const value = new InputEnumValue(config);

        return [value.value, value];
      }),
    );

    this.publicValueMap = new Map(
      [...this.valueMap].filter(([, value]) => value.public),
    );

    this.values = Object.freeze([...this.valueMap.keys()]);
  }

  public hasValue(maybeValue: unknown): boolean {
    return this.valueMap.has(maybeValue as any);
  }

  public getValue(maybeValue: unknown, path?: Path): InputEnumValue {
    const value = this.valueMap.get(maybeValue as any);
    if (value === undefined) {
      throw new UnexpectedValueError(
        maybeValue,
        `a "${this}" (= a value among "${this.values.join(', ')}")`,
        path,
      );
    }

    return value;
  }

  @Memoize()
  public get graphql() {
    assert(
      this.publicValueMap.size > 0,
      `"${this.name}" expects at least one public value`,
    );

    return new GraphQLEnumType({
      name: this.name,
      ...(this.description !== undefined && { description: this.description }),
      values: Object.fromEntries<GraphQLEnumValueConfig>(
        [...this.publicValueMap.values()].map<[string, GraphQLEnumValueConfig]>(
          (value) => [
            value.name,
            {
              value: value.value,
              ...(value.description !== undefined && {
                description: value.description,
              }),
              ...(value.deprecationReason !== undefined && {
                deprecationReason: value.deprecationReason,
              }),
            },
          ],
        ),
      ),
    });
  }
}

export type EnumerableInputType = GraphQLEnumType | InputEnumType;

export function isEnumerableInputType(
  type: unknown,
): type is EnumerableInputType {
  return type instanceof GraphQLEnumType || type instanceof InputEnumType;
}

export function assertEnumerableInputType(type: unknown): EnumerableInputType {
  assert(
    isEnumerableInputType(type),
    `"${type}" is not an enumerable input type`,
  );

  return type;
}

export function assertEnumerableInputValue<TValue = any>(
  type: EnumerableInputType,
  maybeValue: unknown,
  path?: Path,
): TValue {
  if (maybeValue == null) {
    return maybeValue as any;
  }

  if (type instanceof GraphQLEnumType) {
    return assertGraphQLEnumValue(type, maybeValue, path);
  } else if (type instanceof InputEnumType) {
    if (!type.hasValue(maybeValue)) {
      throw new UnexpectedValueError(
        maybeValue,
        `a "${type}" (= a value among "${type.values.join(', ')}")`,
        path,
      );
    }

    return maybeValue as any;
  }

  throw new UnreachableValueError(
    type,
    `a supported enumerable input type`,
    path,
  );
}
