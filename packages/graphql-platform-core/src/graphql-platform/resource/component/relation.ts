import { Maybe, POJO } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { BaseContext, CustomContext } from '../../../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from '../../connector';
import { OperationContext } from '../../operation';
import { CreateOneOperationArgs, UpdateOneOperationArgs } from '../../operation/mutation';
import { NodeValue, Resource, ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { WhereUniqueInputValue } from '../../type/input';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';
import { Unique } from '../unique';
import { Inverse as InverseRelation } from './relation/inverse';

export {
  Inverse as InverseRelation,
  InverseMap as InverseRelationMap,
  InverseSet as InverseRelationSet,
} from './relation/inverse';
export * from './relation/map';
export * from './relation/set';

export type RelationValue = null | NodeValue;

export enum RelationKind {
  toOne = 'toOne',
  toMany = 'toMany',
}

export type RelationHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext, TOperationContext> & {
  relation: Relation;
};

export type RelationHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: RelationHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext, TOperationContext> &
      Readonly<{
        /** Parsed data */
        create: ConnectorCreateInputValue;
      }>;
    /** Parsed relation value */
    relatedNodeId: Maybe<WhereUniqueInputValue>;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: RelationHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext, TOperationContext> &
      Readonly<{
        /** Parsed data */
        update: ConnectorUpdateInputValue;
      }>;
    /** Parsed relation value */
    relatedNodeId: Maybe<WhereUniqueInputValue>;
  };
};

export interface RelationConfig<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = BaseContext,
  TOperationContext extends OperationContext = OperationContext
> extends AbstractComponentConfig<RelationHookMap<TCustomContext, TBaseContext, TOperationContext>> {
  /** Required, name of the targeted resource */
  to: string;

  /** Optional, name of the targeted unique, default: the targeted resource's identifier */
  unique?: Maybe<Unique['name']>;

  /** Optional, name of the inverse relation, default: guessed from the resource's name */
  inversedBy?: Maybe<string>;
}

export class Relation<TConfig extends RelationConfig<any, any, any> = RelationConfig> extends AbstractComponent<
  RelationHookMap,
  TConfig
> {
  public isField(): boolean {
    return false;
  }

  public isRelation(): this is Relation {
    return true;
  }

  @Memoize()
  public getFrom(): Resource {
    return this.resource;
  }

  @Memoize()
  public getTo(): Resource {
    const resource = this.resource.gp.getResourceMap().get(this.config.to);

    if (!resource) {
      throw new Error(
        `The relation "${this.resource.name}.${this.name}"'s target "${
          this.config.to
        }" does not exist, chose among: ${this.resource.gp
          .getResourceMap()
          .getNames()
          .join(', ')}.`,
      );
    }

    return resource;
  }

  @Memoize()
  public getToUnique(): Unique {
    if (this.config.unique) {
      const nonNullableUniqueSet = this.getTo()
        .getUniqueSet()
        .filter(unique => unique.componentSet.some(component => !component.isNullable()));

      const unique = nonNullableUniqueSet.find(({ name }) => name === this.config.unique);

      if (!unique) {
        throw new Error(
          `The relation "${this.resource.name}.${this.name}"'s targeted unique "${
            this.config.unique
          }" does not exist or is not composed of at least one non-nullable component, chose among: ${nonNullableUniqueSet
            .getNames()
            .join(', ')}`,
        );
      }

      return unique;
    }

    return this.getTo().getIdentifier();
  }

  @Memoize()
  public getKind(): RelationKind {
    return RelationKind.toOne;
  }

  public isToOne(): boolean {
    return this.getKind() === RelationKind.toOne;
  }

  public isToMany(): boolean {
    return this.getKind() === RelationKind.toMany;
  }

  @Memoize()
  public getInverse(): InverseRelation<TConfig> {
    return new InverseRelation(this);
  }

  public parseValue(value: unknown): RelationValue | undefined {
    if (typeof value !== 'undefined') {
      if (value === null) {
        if (this.isNullable()) {
          return null;
        } else {
          throw new Error(`The "${this}" relation is not nullable.`);
        }
      } else {
        return this.getTo().parseValue(value);
      }
    }

    return undefined;
  }

  public isValue(value: unknown): value is RelationValue {
    return typeof this.parseValue(value) !== 'undefined';
  }

  public getValue(node: NodeValue): RelationValue | undefined {
    return this.parseValue(node[this.name]);
  }

  public assertValue(node: NodeValue): RelationValue {
    const parsedValue = this.getValue(node);
    if (typeof parsedValue === 'undefined') {
      throw new Error(`The "${this}" relation's value has to be defined.`);
    }

    return parsedValue;
  }

  public setValue(node: NodeValue, value: unknown): void {
    const parsedValue = this.parseValue(value);
    if (typeof parsedValue === 'undefined') {
      delete node[this.name];
    } else {
      node[this.name] = parsedValue;
    }
  }
}
