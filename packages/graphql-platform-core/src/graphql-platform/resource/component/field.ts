import { isScalar, Maybe, POJO, Scalar } from '@prismamedia/graphql-platform-utils';
import { GraphQLLeafType, isLeafType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { BaseContext, CustomContext } from '../../../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from '../../connector';
import { OperationContext } from '../../operation';
import { CreateOneOperationArgs, UpdateOneOperationArgs } from '../../operation/mutation';
import { ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';

export * from './field/map';
export * from './field/set';

export type FieldValue = null | Scalar;

export type FieldHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext, TOperationContext> & {
  field: Field;
};

export type FieldHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: FieldHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext, TOperationContext> &
      Readonly<{
        /** Parsed data */
        create: ConnectorCreateInputValue;
      }>;
    /** Parsed field value */
    fieldValue: Maybe<FieldValue>;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: FieldHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext, TOperationContext> &
      Readonly<{
        /** Parsed data */
        update: ConnectorUpdateInputValue;
      }>;
    /** Parsed field value */
    fieldValue: Maybe<FieldValue>;
  };
};

export interface FieldConfig<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = BaseContext,
  TOperationContext extends OperationContext = OperationContext
> extends AbstractComponentConfig<FieldHookMap<TCustomContext, TBaseContext, TOperationContext>> {
  /** Required, the GraphQL leaf type that represents the output of this field */
  type: GraphQLLeafType;
}

export type AnyFieldConfig = FieldConfig<any, any, any>;

export class Field<TConfig extends AnyFieldConfig = FieldConfig> extends AbstractComponent<FieldHookMap, TConfig> {
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

  public parseValue(value: unknown): FieldValue | undefined {
    if (typeof value !== 'undefined') {
      if (value === null && this.isNullable()) {
        return null;
      } else if (isScalar(value)) {
        return value;
      } else if (value instanceof Date) {
        return value.toISOString();
      }

      throw new Error(
        `The "${this}" field's value has to be a${!this.isNullable() ? ' non-null' : ''} scalar: "${value}" given.`,
      );
    }

    return undefined;
  }

  public isValue(value: unknown): value is FieldValue {
    return typeof this.parseValue(value) !== 'undefined';
  }

  public getValue(node: POJO): FieldValue | undefined {
    return this.parseValue(node[this.name]);
  }

  public assertValue(node: POJO): FieldValue {
    const parsedValue = this.getValue(node);
    if (typeof parsedValue === 'undefined') {
      throw new Error(`The "${this}" field's value is not defined.`);
    }

    return parsedValue;
  }

  public setValue(node: POJO, value: unknown): void {
    const parsedValue = this.parseValue(value);
    if (typeof parsedValue === 'undefined') {
      delete node[this.name];
    } else {
      node[this.name] = parsedValue;
    }
  }
}
