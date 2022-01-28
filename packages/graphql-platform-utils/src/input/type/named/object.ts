import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLInputObjectType } from 'graphql';
import assert from 'node:assert/strict';
import {
  aggregateConfigError,
  UnexpectedConfigError,
  UnexpectedValueError,
} from '../../../error.js';
import { Input, parseInputs } from '../../../input.js';
import { isNil, Nillable } from '../../../nil.js';
import { addPath, Path } from '../../../path.js';
import { isPlainObject, PlainObject } from '../../../plain-object.js';
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

    return Object.freeze(
      fields?.length
        ? aggregateConfigError<TField, TField[]>(
            fields,
            (fields, field, index) => {
              if (!(field instanceof Input)) {
                throw new UnexpectedConfigError(`an input`, field, {
                  path: addPath(this.#fieldsConfigPath, index),
                });
              }

              return [...fields, field];
            },
            [],
            { path: this.#fieldsConfigPath },
          )
        : [],
    );
  }

  @Memoize()
  public get fieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(this.fields.map((field) => [field.name, field]));
  }

  @Memoize()
  public get requiredFieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(
      Array.from(this.fieldsByName).filter(([, field]) => field.isRequired()),
    );
  }

  @Memoize()
  public get requiredFields(): ReadonlyArray<TField> {
    return Object.freeze(Array.from(this.requiredFieldsByName.values()));
  }

  public override isPublic(): boolean {
    if (typeof this.#isPublic !== 'undefined') {
      return this.#isPublic ?? false;
    } else {
      this.#isPublic = null;
    }

    return (this.#isPublic =
      this.fields.some((field) => field.isPublic()) &&
      this.requiredFields.every((field) => field.isPublic()));
  }

  @Memoize()
  public get publicFieldsByName(): ReadonlyMap<TField['name'], TField> {
    return new Map(
      Array.from(this.fieldsByName).filter(([, field]) => field.isPublic()),
    );
  }

  @Memoize()
  public get publicFields(): ReadonlyArray<TField> {
    return Object.freeze(Array.from(this.publicFieldsByName.values()));
  }

  @Memoize()
  public override getGraphQLInputType(): GraphQLInputObjectType {
    assert(this.isPublic(), `The "${this}" input type is private`);

    return new GraphQLInputObjectType({
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
    if (typeof this.#isValid !== 'undefined') {
      return;
    } else {
      this.#isValid = null;
    }

    aggregateConfigError<TField, void>(
      this.fieldsByName.values(),
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

  public getField(name: string, path?: Path): TField {
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

  public parseValue(
    maybeObject: unknown,
    path: Path = addPath(undefined, this.name),
  ): Nillable<PlainObject> {
    if (isNil(maybeObject)) {
      return maybeObject;
    }

    if (!isPlainObject(maybeObject)) {
      throw new UnexpectedValueError('a plain-object', maybeObject, {
        path,
      });
    }

    return parseInputs(this.fields, maybeObject, path);
  }
}
