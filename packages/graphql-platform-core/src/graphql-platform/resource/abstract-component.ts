import {
  FlagConfig,
  getFlagValue,
  Maybe,
} from '@prismamedia/graphql-platform-utils';
import {
  EventConfigMap,
  EventEmitter,
  EventMap,
} from '@prismamedia/ts-async-event-emitter';
import { Memoize } from '@prismamedia/ts-memoize';
import inflector from 'inflection';
import { AnyResource } from '../resource';
import { Field } from './component/field';
import { Relation } from './component/relation';
import { Component, ManagementKind } from './component/types';

export interface AbstractComponentConfig<THookMap extends EventMap = any> {
  /**
   * Optional, a description for this resource's component.
   */
  description?: Maybe<string>;

  /**
   * Optional, either this component is nullable or not.
   * Default: true but if it is part of the identifier
   */
  nullable?: FlagConfig;

  /**
   * Optional, either this component's value comes from the database, a hook, or is provided by the client.
   * Default: false (provided by the client)
   */
  managed?: Maybe<false | ManagementKind>;

  /**
   * Optional, either this component is public (= available in operations' result) or not.
   * Default: true
   */
  public?: FlagConfig;

  /**
   * Optional, either this component is immutable or not.
   * Default: false
   */
  immutable?: FlagConfig;

  /**
   * Optional, act on some events
   */
  hooks?: Maybe<EventConfigMap<THookMap>>;
}

export type AnyAbstractComponentConfig = AbstractComponentConfig<any>;

export abstract class AbstractComponent<
  THookMap extends EventMap,
  TConfig extends AnyAbstractComponentConfig,
> extends EventEmitter<THookMap> {
  public constructor(
    readonly name: string,
    readonly config: TConfig,
    readonly resource: AnyResource,
  ) {
    super();

    config.hooks && this.on(config.hooks);
  }

  public abstract isField(): this is Field;

  public abstract isRelation(): this is Relation;

  public isComponent(): this is Component {
    return this.isField() || this.isRelation();
  }

  @Memoize()
  public toString(): string {
    return `${this.resource.name}.${this.name}`;
  }

  @Memoize()
  public get pascalCasedName(): string {
    return inflector.camelize(this.name, false);
  }

  @Memoize()
  public get description(): string | undefined {
    return this.config.description || undefined;
  }

  /** Either this component is part of the identifier or not */
  @Memoize()
  public isInIdentifier(): boolean {
    return this.resource.getIdentifier().contains(this as any);
  }

  /** Either this component is part of the non-composite identifier or not */
  @Memoize()
  public isIdentifier(): boolean {
    return (
      this.isInIdentifier() && !this.resource.getIdentifier().isComposite()
    );
  }

  /** Either this component is part of a unique or not */
  @Memoize()
  public isInUnique(): boolean {
    return this.resource
      .getUniqueSet()
      .some((unique) => unique.contains(this as any));
  }

  @Memoize()
  public isPublic(): boolean {
    return getFlagValue(this.config.public, true);
  }

  /** Either this component is part of a non-composite unique or not */
  @Memoize()
  public isUnique(): boolean {
    return this.resource
      .getUniqueSet()
      .some(
        (unique) =>
          this.isComponent() &&
          unique.contains(this as any) &&
          !unique.isComposite(),
      );
  }

  @Memoize()
  public isManaged(): false | ManagementKind {
    return typeof this.config.managed === 'string'
      ? this.config.managed
      : false;
  }

  @Memoize()
  public isFullyManaged(): boolean {
    return this.isManaged() === ManagementKind.Full;
  }

  /** Non-nullable output */
  @Memoize()
  public isNullable(): boolean {
    const isNullable = getFlagValue(
      this.config.nullable,
      !(this.isInIdentifier() || this.isManaged()),
    );

    if (isNullable && this.isInIdentifier()) {
      throw new Error(
        `The component "${this}" cannot be "nullable" as it's part of the identifier.`,
      );
    }

    return isNullable;
  }

  /** Non-nullable input */
  @Memoize()
  public isRequired(): boolean {
    return !(this.isNullable() || this.isManaged());
  }

  @Memoize()
  public isImmutable(): boolean {
    const isImmutable = getFlagValue(
      this.config.immutable,
      this.isInIdentifier() || this.resource.isImmutable(),
    );

    if (!isImmutable && this.isInIdentifier()) {
      throw new Error(
        `The component "${this}" has to be "immutable" as it is part of the identifier.`,
      );
    }

    if (!isImmutable && this.resource.isImmutable()) {
      throw new Error(
        `The component "${this}" has to be "immutable" as the resource is.`,
      );
    }

    return isImmutable;
  }

  public isMutable(): boolean {
    return !this.isImmutable();
  }
}

export type AnyAbstractComponent = AbstractComponent<any, any>;
