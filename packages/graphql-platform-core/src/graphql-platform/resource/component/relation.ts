import { Maybe, MaybeUndefinedDecorator, POJO } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { AnyBaseContext, BaseContext, CustomContext } from '../../../graphql-platform';
import { CreateOneOperationArgs, CreateOneRawValue, UpdateOneOperationArgs, UpdateOneRawValue } from '../../operation';
import { RelationUpdate } from '../../operation/mutation';
import { NodeValue, Resource, ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { SerializedWhereUniqueInputValue, WhereUniqueInputValue } from '../../type/input';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';
import { Unique } from '../unique';
import { UniqueSet } from '../unique/set';
import { NullComponentValueError, UndefinedComponentValueError } from './error';
import { Inverse as InverseRelation } from './relation/inverse';

export {
  AnyInverse as AnyInverseRelation,
  Inverse as InverseRelation,
  InverseMap as InverseRelationMap,
  InverseSet as InverseRelationSet,
} from './relation/inverse';
export * from './relation/map';
export * from './relation/set';

export type RelationValue = null | WhereUniqueInputValue;

export type SerializedRelationValue = null | SerializedWhereUniqueInputValue;

export enum RelationKind {
  ToOne = 'toOne',
  ToMany = 'toMany',
}

export type RelationHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = ResourceHookMetaMap<TArgs, TCustomContext, TBaseContext> & {
  relation: Relation;
};

export type RelationHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: RelationHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext> &
      Readonly<{
        create: CreateOneRawValue;
      }>;
    relatedNodeId: RelationValue | undefined;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: RelationHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext> &
      Readonly<{
        toBeUpdatedNodeId: WhereUniqueInputValue;
        update: UpdateOneRawValue;
      }>;
    relatedNodeId: RelationUpdate | undefined;
  };
};

export interface RelationConfig<
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext
> extends AbstractComponentConfig<RelationHookMap<TCustomContext, TBaseContext>> {
  /** Required, name of the targeted resource */
  to: string;

  /** Optional, name of the targeted unique, default: the targeted resource's identifier */
  unique?: Maybe<Unique['name']>;

  /** Optional, name of the inverse relation, default: guessed from the resource's name */
  inversedBy?: Maybe<string>;
}

export type AnyRelationConfig = RelationConfig<any, any>;

export class Relation<TConfig extends AnyRelationConfig = RelationConfig> extends AbstractComponent<
  RelationHookMap,
  TConfig
> {
  public isField(): boolean {
    return false;
  }

  public isRelation(): this is Relation {
    return true;
  }

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
      const nonNullableUniqueSet = this.getTo().getNonNullableUniqueSet();

      const unique = nonNullableUniqueSet.find(({ name }) => name === this.config.unique);
      if (!unique) {
        throw new Error(
          `The relation "${this.resource.name}.${this.name}"'s targeted unique "${
            this.config.unique
          }" does not exist or is "nullable", chose among: ${nonNullableUniqueSet.getNames().join(', ')}`,
        );
      }

      return unique;
    }

    return this.getTo().getIdentifier();
  }

  @Memoize()
  public getToUniqueSet(): UniqueSet {
    return new UniqueSet([this.getToUnique(), ...this.getTo().getUniqueSet()]);
  }

  public getKind(): RelationKind {
    return RelationKind.ToOne;
  }

  public isToOne(): boolean {
    return true;
  }

  public isToMany(): boolean {
    return false;
  }

  @Memoize()
  public getInverse(): InverseRelation<TConfig> {
    return new InverseRelation(this);
  }

  public assertValue(value: unknown, normalized?: boolean): RelationValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    return normalized
      ? this.getTo()
          .getInputType('WhereUnique')
          .assertUnique(value, this.getToUnique(), true)
      : this.getTo()
          .getInputType('WhereUnique')
          .assert(value, this.getToUniqueSet());
  }

  public serialize(value: RelationValue, normalized?: boolean): SerializedRelationValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    return normalized
      ? this.getTo().serialize(value, true, this.getToUnique().componentSet)
      : this.getTo().serialize(value);
  }

  public parseValue(value: SerializedRelationValue, normalized?: boolean): RelationValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this);
    } else if (value === null) {
      if (!this.isNullable()) {
        throw new NullComponentValueError(this);
      }

      return null;
    }

    return normalized
      ? this.getTo().parseValue(value, true, this.getToUnique().componentSet)
      : this.getTo().parseValue(value);
  }

  public pickValue<TStrict extends boolean>(
    node: NodeValue,
    normalized?: boolean,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<RelationValue, TStrict> {
    const value = node[this.name];
    if (typeof value === 'undefined') {
      if (strict === true) {
        throw new UndefinedComponentValueError(this);
      }

      return undefined as any;
    }

    return this.assertValue(value, normalized) as any;
  }

  public setValue(node: NodeValue, value: RelationValue): void {
    node[this.name] = this.assertValue(value);
  }
}

export type AnyRelation = Relation<any>;
