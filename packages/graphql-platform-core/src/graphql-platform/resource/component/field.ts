import { isScalar, Maybe, POJO, Scalar } from '@prismamedia/graphql-platform-utils';
import { GraphQLLeafType, isLeafType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { BaseContext, CustomContext } from '../../../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from '../../connector';
import { CreateOneOperationArgs, UpdateOneOperationArgs } from '../../operation/mutation';
import { ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';

export * from './field/map';
export * from './field/set';

export type FieldValue = null | Scalar;

export type FieldHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext> & {
  field: Field;
};

export interface FieldHookMap<TCustomContext extends CustomContext = any, TBaseContext extends BaseContext = any> {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: Readonly<
      FieldHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext> & {
        /** Parsed data */
        create: ConnectorCreateInputValue;
      }
    >;
    /** Parsed field value */
    fieldValue: Maybe<FieldValue>;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: Readonly<
      FieldHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext> & {
        /** Parsed data */
        update: ConnectorUpdateInputValue;
      }
    >;
    /** Parsed field value */
    fieldValue: Maybe<FieldValue>;
  };
}

export interface FieldConfig<TCustomContext extends CustomContext = any, TBaseContext extends BaseContext = any>
  extends AbstractComponentConfig<FieldHookMap<TCustomContext, TBaseContext>> {
  /** Required, the GraphQL leaf type that represents the output of this field */
  type: GraphQLLeafType;
}

export class Field<TConfig extends FieldConfig = any> extends AbstractComponent<FieldHookMap, TConfig> {
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
      if ((value === null && this.isNullable()) || isScalar(value)) {
        return value;
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
