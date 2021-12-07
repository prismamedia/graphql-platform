import {
  MaybeUndefinedDecorator,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLLeafType,
  GraphQLScalarType,
  GraphQLString,
  isEnumType,
  isScalarType,
} from 'graphql';
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date';
import {
  AnyBaseContext,
  BaseContext,
  CustomContext,
  NodeSource,
} from '../../../graphql-platform';
import {
  CreateOneOperationArgs,
  CreateOneRawValue,
  FieldUpdate,
  UpdateOneOperationArgs,
  UpdateOneRawValue,
} from '../../operation';
import {
  NodeValue,
  ResourceHookKind,
  ResourceHookMetaMap,
} from '../../resource';
import { WhereUniqueInputValue } from '../../type/input';
import {
  AbstractComponent,
  AbstractComponentConfig,
} from '../abstract-component';
import {
  InvalidComponentValueError,
  InvalidEnumFieldValueError,
  NullComponentValueError,
  UndefinedComponentValueError,
} from './error';

export {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql';
export { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date';
export * from './field/map';
export * from './field/set';

export type GraphQLBooleanValue = boolean;
export type SerializedGraphQLBooleanValue = boolean;

export type GraphQLDateValue = Date;
export type SerializedGraphQLDateValue = string;

export type GraphQLDateTimeValue = Date;
export type SerializedGraphQLDateTimeValue = string;

export type GraphQLFloatValue = number;
export type SerializedGraphQLFloatValue = number;

export type GraphQLIDValue = string;
export type SerializedGraphQLIDValue = string;

export type GraphQLIntValue = number;
export type SerializedGraphQLIntValue = number;

export type GraphQLStringValue = string;
export type SerializedGraphQLStringValue = string;

export type GraphQLTimeValue = Date;
export type SerializedGraphQLTimeValue = string;

// Supported scalar types
export const supportedScalarTypes: GraphQLScalarType[] = [
  GraphQLBoolean,
  GraphQLDate,
  GraphQLDateTime,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  GraphQLTime,
];

export type FieldValue =
  | null
  | GraphQLBooleanValue
  | GraphQLDateValue
  | GraphQLDateTimeValue
  | GraphQLFloatValue
  | GraphQLIDValue
  | GraphQLIntValue
  | GraphQLStringValue
  | GraphQLTimeValue;

export type SerializedFieldValue =
  | null
  | SerializedGraphQLBooleanValue
  | SerializedGraphQLDateValue
  | SerializedGraphQLDateTimeValue
  | SerializedGraphQLFloatValue
  | SerializedGraphQLIDValue
  | SerializedGraphQLIntValue
  | SerializedGraphQLStringValue
  | SerializedGraphQLTimeValue;

export type FieldHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext,
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext> &
  Readonly<{
    field: Field;
  }>;

export type FieldHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext,
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: FieldHookMetaMap<
      CreateOneOperationArgs,
      TCustomContext,
      TBaseContext
    > &
      Readonly<{
        create: CreateOneRawValue;
      }>;
    fieldValue: FieldValue | undefined;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: FieldHookMetaMap<
      UpdateOneOperationArgs,
      TCustomContext,
      TBaseContext
    > &
      Readonly<{
        toBeUpdatedNodeId: WhereUniqueInputValue;
        toBeUpdatedNode?: NodeSource;
        update: UpdateOneRawValue;
      }>;
    fieldValue: FieldUpdate | undefined;
  };
};

export interface FieldConfig<
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext,
> extends AbstractComponentConfig<FieldHookMap<TCustomContext, TBaseContext>> {
  /**
   * Required, the GraphQL type that represents the output of this field, the supported types are:
   *
   * - GraphQLBoolean
   * - GraphQLDate
   * - GraphQLDateTime
   * - GraphQLEnumType
   * - GraphQLFloat
   * - GraphQLID
   * - GraphQLInt
   * - GraphQLString
   * - GraphQLTime
   */
  type: GraphQLLeafType;
}

export type AnyFieldConfig = FieldConfig<any, any>;

export class Field<
  TConfig extends AnyFieldConfig = FieldConfig,
> extends AbstractComponent<FieldHookMap, TConfig> {
  public isField(): this is Field {
    return true;
  }

  public isRelation(): boolean {
    return false;
  }

  @Memoize()
  public getType(): GraphQLLeafType {
    const type = this.config.type;

    if (
      !(
        (isScalarType(type) && supportedScalarTypes.includes(type)) ||
        isEnumType(type)
      )
    ) {
      throw new Error(
        `The field "${this.resource.name}.${
          this.name
        }" has to be a "leaf", an Enum or one of the following scalar types: ${supportedScalarTypes.join(
          ', ',
        )}`,
      );
    }

    return type;
  }

  public assertValue(maybeValue: unknown): FieldValue {
    if (typeof maybeValue === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (maybeValue === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    const type = this.getType();

    if (type instanceof GraphQLEnumType) {
      if (!type.getValues().find(({ value }) => value === maybeValue)) {
        throw new InvalidEnumFieldValueError(this, type, maybeValue);
      }
    } else {
      switch (type.name) {
        case 'Boolean':
          if (typeof maybeValue !== 'boolean') {
            throw new InvalidComponentValueError(
              this,
              `a boolean is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        case 'DateTime':
        case 'Date':
        case 'Time':
          if (!(maybeValue instanceof Date)) {
            throw new InvalidComponentValueError(
              this,
              `a Date is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        case 'Float':
          if (
            !(typeof maybeValue === 'number' && Number.isFinite(maybeValue))
          ) {
            throw new InvalidComponentValueError(
              this,
              `a float is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        case 'ID':
          if (typeof maybeValue !== 'string') {
            throw new InvalidComponentValueError(
              this,
              `a string is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        case 'Int':
          if (
            !(typeof maybeValue === 'number' && Number.isInteger(maybeValue))
          ) {
            throw new InvalidComponentValueError(
              this,
              `an integer is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        case 'String':
          if (typeof maybeValue !== 'string') {
            throw new InvalidComponentValueError(
              this,
              `a string is expected but received "${maybeValue}" instead`,
            );
          }
          break;

        default:
          throw new Error(
            `The "${this}"'s type "${type.name}" is not supported, yet`,
          );
      }
    }

    return maybeValue as FieldValue;
  }

  public serializeValue(value: FieldValue): SerializedFieldValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    return this.getType().serialize(value);
  }

  public parseValue(value: SerializedFieldValue): FieldValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    return this.getType().parseValue(value);
  }

  public pickValue<TStrict extends boolean>(
    node: NodeValue,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<FieldValue, TStrict> {
    const value = node[this.name];
    if (typeof value === 'undefined') {
      if (strict === true) {
        throw new UndefinedComponentValueError(this);
      }

      return undefined as any;
    }

    return this.assertValue(value) as any;
  }

  public setValue(node: NodeValue, value: FieldValue): void {
    node[this.name] = this.assertValue(value);
  }
}

export type AnyField = Field<any>;
