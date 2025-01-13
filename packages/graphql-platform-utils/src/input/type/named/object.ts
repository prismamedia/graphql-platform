import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import {
  aggregateGraphError,
  GraphError,
  UnexpectedValueError,
} from '../../../error.js';
import { Input, parseInputLiterals, parseInputValues } from '../../../input.js';
import { isNil, type Nillable } from '../../../nil.js';
import { addPath, type Path } from '../../../path.js';
import {
  assertPlainObject,
  isPlainObject,
  type PlainObject,
} from '../../../plain-object.js';
import {
  areInputValuesEqual,
  type NonNullNonVariableGraphQLValueNode,
} from '../../type.js';
import {
  AbstractNamedInputType,
  AbstractNamedInputTypeConfig,
} from './abstract.js';

export interface ObjectInputTypeConfig<TField extends Input>
  extends AbstractNamedInputTypeConfig {
  readonly fields?:
    | ReadonlyArray<TField>
    | ((type: ObjectInputType<TField>) => ReadonlyArray<TField>);
}

export class ObjectInputType<
  TField extends Input = any,
> extends AbstractNamedInputType<PlainObject> {
  readonly #fieldsConfig: ObjectInputTypeConfig<TField>['fields'];
  readonly #fieldsConfigPath: Path;

  #isPublic?: null | boolean;
  #isValid?: null | true;

  public constructor(
    { fields, ...config }: ObjectInputTypeConfig<TField>,
    configPath: Path = addPath(undefined, config.name),
  ) {
    super(config, configPath);

    this.#fieldsConfig = fields;
    this.#fieldsConfigPath = addPath(configPath, 'fields');
  }

  @Memoize()
  public get fields(): ReadonlyArray<TField> {
    const fields =
      typeof this.#fieldsConfig === 'function'
        ? this.#fieldsConfig(this)
        : this.#fieldsConfig;

    return fields?.length
      ? aggregateGraphError<TField, TField[]>(
          fields,
          (fields, field, index) => {
            if (!(field instanceof Input)) {
              throw new UnexpectedValueError(`an input`, field, {
                path: addPath(this.#fieldsConfigPath, index),
              });
            }

            return [...fields, field];
          },
          [],
          { path: this.#fieldsConfigPath },
        )
      : [];
  }

  @Memoize()
  public get fieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(this.fields.map((field) => [field.name, field]));
  }

  @Memoize()
  public get requiredFieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(
      this.fieldsByName.entries().filter(([, field]) => field.isRequired()),
    );
  }

  @Memoize()
  public get requiredFields(): ReadonlyArray<TField> {
    return Array.from(this.requiredFieldsByName.values());
  }

  public override isPublic(): boolean {
    if (this.#isPublic !== undefined) {
      return this.#isPublic ?? false;
    } else {
      // We mark it as "null" to go through the circular dependencies (the test above will return "false")
      this.#isPublic = null;
    }

    return (this.#isPublic =
      this.fields.some((field) => field.isPublic()) &&
      this.requiredFields.every((field) => field.isPublic()));
  }

  @Memoize()
  public get publicFieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(
      this.fieldsByName.entries().filter(([, field]) => field.isPublic()),
    );
  }

  @Memoize()
  public get publicFields(): ReadonlyArray<TField> {
    return Array.from(this.publicFieldsByName.values());
  }

  @Memoize()
  public override getGraphQLInputType(): graphql.GraphQLInputObjectType {
    assert(this.isPublic(), `The "${this}" input type is private`);

    return new graphql.GraphQLInputObjectType({
      name: this.name,
      description: this.description,
      fields: () =>
        Object.fromEntries(
          this.publicFields.map((field) => [
            field.name,
            field.getGraphQLConfig(),
          ]),
        ),
    });
  }

  public override validate(): void {
    if (this.#isValid !== undefined) {
      return;
    } else {
      // We mark it as "null" to go through the circular dependencies
      this.#isValid = null;
    }

    aggregateGraphError<TField, void>(
      this.fields,
      (_, field) => field.validate(),
      undefined,
      { path: this.#fieldsConfigPath },
    );

    this.fieldsByName;
    this.fields;
    this.requiredFieldsByName;
    this.requiredFields;
    this.publicFieldsByName;
    this.publicFields;

    if (this.isPublic()) {
      this.getGraphQLInputType();
    }

    this.#isValid = true;
  }

  public getFieldByName(name: string, path?: Path): TField {
    const field = this.fieldsByName.get(name);
    if (!field) {
      throw new UnexpectedValueError(
        `a name among "${[...this.fieldsByName.keys()].join(', ')}"`,
        name,
        { path },
      );
    }

    return field;
  }

  public override parseValue(
    value: unknown,
    path?: Path,
  ): Nillable<PlainObject> {
    if (isNil(value)) {
      return value;
    }

    assertPlainObject(value, path);

    return parseInputValues(this.fields, value, path);
  }

  public override parseLiteral(
    value: NonNullNonVariableGraphQLValueNode,
    variableValues?: graphql.GraphQLResolveInfo['variableValues'],
    path?: Path,
  ): Nillable<PlainObject> {
    if (value.kind === graphql.Kind.OBJECT) {
      return parseInputLiterals(
        this.fields,
        value.fields,
        variableValues,
        path,
      );
    }

    throw new GraphError(`Cannot parse literal: ${graphql.print(value)}`, {
      path,
    });
  }

  public areValuesEqual(a: unknown, b: unknown): boolean {
    return a == null || b == null
      ? a === b
      : isPlainObject(a) &&
          isPlainObject(b) &&
          this.fields.every(({ type, name }) =>
            areInputValuesEqual(type, a[name], b[name]),
          );
  }
}
