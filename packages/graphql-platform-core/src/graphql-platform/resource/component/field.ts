import { isScalar, MaybeUndefinedDecorator, POJO, Scalar } from '@prismamedia/graphql-platform-utils';
import { GraphQLLeafType, isLeafType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { AnyBaseContext, BaseContext, CustomContext } from '../../../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from '../../connector';
import { CreateOneOperationArgs, UpdateOneOperationArgs } from '../../operation/mutation';
import { ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';

export * from './field/map';
export * from './field/set';

export type FieldValue = null | Scalar | Date;

export function isFieldValue(value: unknown, nullable: boolean = true): value is FieldValue {
  return value === null ? nullable : isScalar(value) || value instanceof Date;
}

export type FieldHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext> & {
  field: Field;
};

export type FieldHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: FieldHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext> &
      Readonly<{
        /** Parsed data */
        create: ConnectorCreateInputValue;
      }>;
    /** Parsed field value */
    fieldValue: FieldValue | undefined;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: FieldHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext> &
      Readonly<{
        /** Parsed data */
        update: ConnectorUpdateInputValue;
      }>;
    /** Parsed field value */
    fieldValue: FieldValue | undefined;
  };
};

export interface FieldConfig<
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext
> extends AbstractComponentConfig<FieldHookMap<TCustomContext, TBaseContext>> {
  /** Required, the GraphQL leaf type that represents the output of this field */
  type: GraphQLLeafType;
}

export type AnyFieldConfig = FieldConfig<any, any>;

export class Field<TConfig extends AnyFieldConfig = FieldConfig> extends AbstractComponent<
  FieldHookMap,
  TConfig,
  FieldValue
> {
  public isField(): this is Field {
    return true;
  }

  public isRelation(): boolean {
    return false;
  }

  @Memoize()
  public getType(): GraphQLLeafType {
    const fieldType = this.config.type;

    if (!isLeafType(fieldType)) {
      throw new Error(
        `The field "${this.resource.name}.${this.name}" has to be a "leaf" (= a "scalar" or an "enum") type.`,
      );
    }

    return fieldType;
  }

  public isValue(value: unknown): value is FieldValue {
    return isFieldValue(value, this.isNullable());
  }

  public parseValue<TStrict extends boolean>(
    value: unknown,
    strict: TStrict,
  ): MaybeUndefinedDecorator<FieldValue, TStrict> {
    if (typeof value !== 'undefined') {
      if (value === null) {
        if (!this.isNullable()) {
          throw new Error(`The "${this}" field's value cannot be null`);
        }

        return null as any;
      } else if (!this.isValue(value)) {
        throw new Error(`The "${this}" field's value is not valid: ${JSON.stringify(value)}`);
      }

      return value as any;
    }

    if (strict) {
      throw new Error(`The "${this}" field's value cannot be undefined`);
    }

    return undefined as any;
  }
}
