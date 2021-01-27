import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import { GraphQLInputObjectType } from 'graphql';
import { Except } from 'type-fest';
import { UnexpectedValueError } from '../../../errors';
import { isIterableObject } from '../../../iterable';
import { isNullish } from '../../../nullish';
import { isPlainObject, PlainObject } from '../../../object';
import { addPath, Path } from '../../../path';
import { InputField, InputFieldConfig } from '../../field';
import {
  AbstractNamedInputType,
  AbstractNamedInputTypeConfig,
} from './abstract';

export interface InputObjectTypeConfig extends AbstractNamedInputTypeConfig {
  fields:
    | { [name: string]: Except<InputFieldConfig, 'name'> }
    | Iterable<InputFieldConfig>;
}

export class InputObjectType extends AbstractNamedInputType {
  public readonly fieldMap: ReadonlyMap<InputField['name'], InputField>;
  public readonly publicFieldMap: ReadonlyMap<InputField['name'], InputField>;

  public constructor(config: InputObjectTypeConfig) {
    super(config);

    const fieldConfigs: InputFieldConfig[] = isPlainObject(config.fields)
      ? Object.entries(config.fields).map(([name, config]) => ({
          name,
          ...config,
        }))
      : isIterableObject(config.fields)
      ? [...config.fields]
      : [];

    this.fieldMap = new Map(
      fieldConfigs.map((config) => {
        const field = new InputField(config);

        return [field.name, field];
      }),
    );

    this.publicFieldMap = new Map(
      [...this.fieldMap].filter(([, field]) => field.public),
    );
  }

  @Memoize()
  public get graphql() {
    assert(
      this.publicFieldMap.size > 0,
      `"${this.name}" expects at least one public field`,
    );

    return new GraphQLInputObjectType({
      name: this.name,
      description: this.description,
      fields: Object.fromEntries(
        [...this.publicFieldMap.values()].map((field) => [
          field.name,
          field.graphql,
        ]),
      ),
    });
  }
}

export function assertInputObjectValue<
  TValue extends PlainObject | undefined = any,
>(
  objectTypeOrFields: InputObjectType | Iterable<InputField>,
  maybeObject: unknown,
  path?: Path,
): TValue {
  if (!(isNullish(maybeObject) || isPlainObject(maybeObject))) {
    throw new UnexpectedValueError(
      maybeObject,
      `"undefined", "null" or a "plain object"`,
      path,
    );
  }

  const fields: Iterable<InputField> =
    objectTypeOrFields instanceof InputObjectType
      ? objectTypeOrFields.fieldMap.values()
      : objectTypeOrFields;

  /**
   * We keep the provided object's keys here, in order to check
   * further if some extra have been provided
   */
  const keySet = new Set(maybeObject ? Object.keys(maybeObject) : undefined);

  const result = [...fields].reduce<PlainObject | undefined>(
    (result, field) => {
      keySet.delete(field.name);

      const fieldValue = field.assertValue(
        maybeObject?.[field.name],
        addPath(path, field.name),
      );

      return fieldValue !== undefined
        ? Object.assign(result ?? Object.create(null), {
            [field.name]: fieldValue,
          })
        : result;
    },
    undefined,
  );

  if (keySet.size > 0) {
    throw new UnexpectedValueError(
      maybeObject,
      `not to contain the extra key(s) "${[...keySet].join(', ')}"`,
      path,
    );
  }

  return result as any;
}
