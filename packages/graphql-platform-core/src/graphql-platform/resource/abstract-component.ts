import { FlagConfig, getFlagValue, Maybe, MaybeUndefinedDecorator, POJO } from '@prismamedia/graphql-platform-utils';
import { EventConfigMap, EventEmitter, EventMap } from '@prismamedia/ts-async-event-emitter';
import inflector from 'inflection';
import { Memoize } from 'typescript-memoize';
import { Resource } from '../resource';
import { isComponent } from './component';
import { Field } from './component/field';
import { Relation } from './component/relation';
import { ComponentValue, ManagementKind } from './component/types';

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

  /** Optional, act on some events */
  hooks?: Maybe<EventConfigMap<THookMap>>;
}

export type AnyAbstractComponentConfig = AbstractComponentConfig<any>;

export abstract class AbstractComponent<
  THookMap extends EventMap = EventMap,
  TConfig extends AnyAbstractComponentConfig = AbstractComponentConfig<THookMap>,
  TValue extends ComponentValue = ComponentValue
> extends EventEmitter<THookMap> {
  public constructor(readonly name: string, readonly config: TConfig, readonly resource: Resource) {
    super();

    config.hooks && this.onConfig(config.hooks);
  }

  public abstract isField(): this is Field;

  public abstract isRelation(): this is Relation;

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
    return isComponent(this) && this.resource.getIdentifier().contains(this);
  }

  /** Either this component is part of the non-composite identifier or not */
  @Memoize()
  public isIdentifier(): boolean {
    return this.isInIdentifier() && !this.resource.getIdentifier().isComposite();
  }

  /** Either this component is part of a unique or not */
  @Memoize()
  public isInUnique(): boolean {
    return this.resource.getUniqueSet().some(unique => isComponent(this) && unique.contains(this));
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
      .some(unique => isComponent(this) && unique.contains(this) && !unique.isComposite());
  }

  @Memoize()
  public isManaged(): false | ManagementKind {
    return typeof this.config.managed === 'string' ? this.config.managed : false;
  }

  @Memoize()
  public isFullyManaged(): boolean {
    return this.isManaged() === ManagementKind.Full;
  }

  /** Non-nullable output */
  @Memoize()
  public isNullable(): boolean {
    const isNullable = getFlagValue(this.config.nullable, !(this.isInIdentifier() || this.isManaged()));

    if (isNullable && this.isInIdentifier()) {
      throw new Error(`The component "${this}" cannot be "nullable" as it's part of the identifier.`);
    }

    if (isNullable && this.isManaged()) {
      throw new Error(`The component "${this}" cannot be "nullable" as it's managed.`);
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
    const isImmutable = getFlagValue(this.config.immutable, this.isInIdentifier() || this.resource.isImmutable());

    if (!isImmutable && this.isInIdentifier()) {
      throw new Error(`The component "${this}" has to be "immutable" as it is part of the identifier.`);
    }

    if (!isImmutable && this.resource.isImmutable()) {
      throw new Error(`The component "${this}" has to be "immutable" as the resource is.`);
    }

    return isImmutable;
  }

  public abstract isValue(value: unknown): value is TValue;

  public abstract parseValue<TStrict extends boolean>(
    value: unknown,
    strict: TStrict,
  ): MaybeUndefinedDecorator<TValue, TStrict>;

  public hasValue(node: POJO): boolean {
    return this.isValue(node[this.name]);
  }

  public getValue<TStrict extends boolean>(node: POJO, strict: TStrict): MaybeUndefinedDecorator<TValue, TStrict> {
    return this.parseValue(node[this.name], strict);
  }

  public setValue(node: POJO, value: TValue | undefined): void {
    if (typeof value === 'undefined') {
      delete node[this.name];
    } else {
      node[this.name] = value;
    }
  }
}

export type AnyAbstractComponent = AbstractComponent<any, any, any>;
