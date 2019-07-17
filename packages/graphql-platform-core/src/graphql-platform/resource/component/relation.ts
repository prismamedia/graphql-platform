import { isPlainObject, Maybe, MaybeUndefinedDecorator, POJO } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { AnyBaseContext, BaseContext, CustomContext } from '../../../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from '../../connector';
import { CreateOneOperationArgs, UpdateOneOperationArgs } from '../../operation/mutation';
import { NodeValue, Resource, ResourceHookKind, ResourceHookMetaMap } from '../../resource';
import { WhereUniqueInputValue } from '../../type/input';
import { AbstractComponent, AbstractComponentConfig } from '../abstract-component';
import { Unique } from '../unique';
import { UniqueSet } from '../unique/set';
import { Inverse as InverseRelation } from './relation/inverse';

export {
  Inverse as InverseRelation,
  InverseMap as InverseRelationMap,
  InverseSet as InverseRelationSet,
} from './relation/inverse';
export * from './relation/map';
export * from './relation/set';

export type RelationValue = null | NodeValue;

export type NormalizedRelationValue = null | WhereUniqueInputValue;

export enum RelationKind {
  toOne = 'toOne',
  toMany = 'toMany',
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
        /** Parsed data */
        create: ConnectorCreateInputValue;
      }>;
    /** Parsed relation value */
    relatedNodeId: Maybe<WhereUniqueInputValue>;
  };

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: RelationHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext> &
      Readonly<{
        /** Parsed data */
        update: ConnectorUpdateInputValue;
      }>;
    /** Parsed relation value */
    relatedNodeId: Maybe<WhereUniqueInputValue>;
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
  TConfig,
  RelationValue
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

  public isId(value: unknown): value is WhereUniqueInputValue {
    return (
      typeof this.getTo()
        .getInputType('WhereUnique')
        .parse(value, false) !== 'undefined'
    );
  }

  public parseId<TStrict extends boolean>(
    value: unknown,
    strict: TStrict,
    // Accept only the defined unique
    relationToUniqueOnly: boolean = false,
  ): MaybeUndefinedDecorator<NormalizedRelationValue, TStrict> {
    if (typeof value !== 'undefined') {
      if (value === null) {
        if (!this.isNullable()) {
          throw new Error(`The "${this}" relation's value cannot be null`);
        }

        return null as any;
      }

      return relationToUniqueOnly
        ? this.getTo()
            .getInputType('WhereUnique')
            .parseUnique(value, this.getToUnique(), strict, relationToUniqueOnly)
        : this.getTo()
            .getInputType('WhereUnique')
            .parse(value, strict, this.getToUniqueSet());
    }

    if (strict) {
      throw new Error(`The "${this}" relation's value cannot be undefined`);
    }

    return undefined as any;
  }

  public getId<TStrict extends boolean>(
    node: POJO,
    strict: TStrict,
    // Accept only the defined unique
    relationToUniqueOnly: boolean = false,
  ): MaybeUndefinedDecorator<NormalizedRelationValue, TStrict> {
    return this.parseId(node[this.name], strict, relationToUniqueOnly);
  }

  public isValue(value: unknown): value is RelationValue {
    return value === null ? this.isNullable() : this.getTo().isValue(value);
  }

  public parseValue<TStrict extends boolean>(
    value: unknown,
    strict: TStrict,
  ): MaybeUndefinedDecorator<RelationValue, TStrict> {
    if (typeof value !== 'undefined') {
      if (value === null) {
        if (!this.isNullable()) {
          throw new Error(`The "${this}" relation's value cannot be null`);
        }

        return null as any;
      } else if (!isPlainObject(value)) {
        throw new Error(`The "${this}" relation's value has to be a plain object: ${JSON.stringify(value)}`);
      }

      return this.getTo().parseValue(value, strict, false);
    }

    if (strict) {
      throw new Error(`The "${this}" relation's value cannot be undefined`);
    }

    return undefined as any;
  }

  public getValue<TStrict extends boolean>(
    node: POJO,
    strict: TStrict,
  ): MaybeUndefinedDecorator<RelationValue, TStrict> {
    return this.parseValue(node[this.name], strict);
  }
}
