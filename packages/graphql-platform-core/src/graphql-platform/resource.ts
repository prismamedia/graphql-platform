import {
  FlagConfig,
  fromEntries,
  getFlagValue,
  getPlainObjectKeys,
  GraphQLOperationType,
  isPlainObject,
  loadModuleMap,
  Maybe,
  MaybePromise,
  ModuleMapConfig,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { EventConfigMap, EventEmitter } from '@prismamedia/ts-async-event-emitter';
import inflector from 'inflection';
import { Memoize } from 'typescript-memoize';
import { AnyBaseContext, AnyGraphQLPlatform, BaseContext, Context, CustomContext, NodeSource } from '../graphql-platform';
import {
  CreateOneOperationArgs,
  CreateOneRawValue,
  DeleteOneOperationArgs,
  Operation,
  OperationConstructor,
  OperationConstructorMap,
  OperationEventMap,
  OperationId,
  OperationType,
  operationTypeMap,
  OperationTypeMapConfig,
  UpdateOneOperationArgs,
  UpdateOneRawValue,
} from './operation';
import {
  AnyFieldConfig,
  AnyRelationConfig,
  Component,
  ComponentMap,
  ComponentSet,
  ComponentValue,
  Field,
  FieldConfig,
  FieldMap,
  FieldSet,
  FieldValue,
  InverseRelationMap,
  InverseRelationSet,
  Relation,
  RelationConfig,
  RelationMap,
  RelationSet,
  RelationValue,
  SerializedComponentValue,
  SerializedFieldValue,
  SerializedRelationValue,
} from './resource/component';
import { InvalidNodeValueError } from './resource/error';
import { ResourceMap } from './resource/map';
import { AnyUniqueFullConfig, Unique, UniqueConfig, UniqueFullConfig, UniqueSet } from './resource/unique';
import { VirtualField, VirtualFieldConfig, VirtualFieldMap, VirtualFieldSet } from './resource/virtual-field';
import {
  InputTypeConstructor,
  InputTypeId,
  inputTypeMap,
  OutputTypeConstructor,
  OutputTypeId,
  outputTypeMap,
  SerializedWhereUniqueInputValue,
  WhereInputValue,
  WhereUniqueInputValue,
} from './type';

export * from './resource/component';
export * from './resource/error';
export * from './resource/graph';
export * from './resource/map';
export * from './resource/set';
export * from './resource/unique';
export * from './resource/virtual-field';

export type NodeValue = { [componentName: string]: ComponentValue };

export type SerializedNodeValue = { [componentName: string]: SerializedComponentValue };

export type MaybeResourceAware<T = any> = T | ((args: { resource: Resource }) => T);

export type MaybeResourceMapAware<T = any> = T | ((args: { resourceMap: ResourceMap }) => T);

export type ResourceFilterValue = WhereInputValue | false;

export enum ResourceHookKind {
  PreCreate = 'PRE_CREATE',
  PostCreate = 'POST_CREATE',
  PreUpdate = 'PRE_UPDATE',
  PostUpdate = 'POST_UPDATE',
  PreDelete = 'PRE_DELETE',
  PostDelete = 'POST_DELETE',
}

export type ResourceHookMetaMap<
  TArgs extends POJO = any,
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = Readonly<{ args: TArgs; context: Context<TCustomContext, TBaseContext>; resource: Resource }>;

export type ResourceHookMap<
  TCustomContext extends CustomContext = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: ResourceHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext>;
    create: CreateOneRawValue;
  };
  [ResourceHookKind.PostCreate]: Readonly<{
    metas: ResourceHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext>;
    // Contains the whole node value: all the fields and relation's ids
    createdNode: SerializedNodeValue;
  }>;

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: ResourceHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext> & {
      toBeUpdatedNodeId: WhereUniqueInputValue;
      toBeUpdatedNode?: NodeSource;
    };
    // @deprecated
    toBeUpdatedNodeId: WhereUniqueInputValue;
    update: UpdateOneRawValue;
  };
  [ResourceHookKind.PostUpdate]: Readonly<{
    metas: ResourceHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext>;
    // Contains the whole node value: all the fields and relation's ids
    updatedNode: SerializedNodeValue;
  }>;

  // Delete
  [ResourceHookKind.PreDelete]: {
    metas: ResourceHookMetaMap<DeleteOneOperationArgs, TCustomContext, TBaseContext>;
    toBeDeletedNodeId: WhereUniqueInputValue;
  };
  [ResourceHookKind.PostDelete]: Readonly<{
    metas: ResourceHookMetaMap<DeleteOneOperationArgs, TCustomContext, TBaseContext>;
    // Contains the whole node value: all the fields and relation's ids
    deletedNode: SerializedNodeValue;
  }>;
};

export interface ResourceConfig<
  TCustomContext extends CustomContext = {},
  TBaseContext extends AnyBaseContext = BaseContext,
  TUniqueFullConfig extends AnyUniqueFullConfig = UniqueFullConfig,
  TFieldConfig extends AnyFieldConfig = FieldConfig<TCustomContext, TBaseContext>,
  TRelationConfig extends AnyRelationConfig = RelationConfig<TCustomContext, TBaseContext>
> {
  /** Optional, this resource's plural form, default: guessed from the resource's name */
  plural?: Maybe<string>;

  /** Optional, a description */
  description?: Maybe<string>;

  /** Optional, a list of fields */
  fields?: ModuleMapConfig<TFieldConfig>;

  /** Optional, a list of relations */
  relations?: ModuleMapConfig<TRelationConfig>;

  /** Required, the list of the unique constraints. At least one is required as it will be used as this resource's identifier */
  uniques?: Maybe<UniqueConfig<TUniqueFullConfig>[]>;

  /** Optional, either this resource is immutable (= all its components are immutables) or not, default: false */
  immutable?: FlagConfig;

  /** Optional, fine-tune the operations */
  operations?: Maybe<OperationTypeMapConfig>;

  /** Optional, a list of virtual fields (= dynamic fields) */
  virtualFields?: MaybeResourceAware<
    ModuleMapConfig<MaybeResourceAware<VirtualFieldConfig<TCustomContext, TBaseContext>>>
  >;

  /** Optional, a filter applied to all the queries, "false" means returning nothing. */
  filter?: Maybe<
    ResourceFilterValue | ((context: Context<TCustomContext, TBaseContext>) => MaybePromise<Maybe<ResourceFilterValue>>)
  >;

  /** Optional, the behavior of the mutations can be customized by applying hooks */
  hooks?: Maybe<EventConfigMap<ResourceHookMap<TCustomContext, TBaseContext>>>;
}

export type AnyResourceConfig = ResourceConfig<any, any, any, any, any>;

export class Resource<TConfig extends AnyResourceConfig = ResourceConfig> extends EventEmitter<
  ResourceHookMap & OperationEventMap
> {
  public constructor(readonly name: string, readonly config: TConfig, readonly gp: AnyGraphQLPlatform) {
    super();

    const pascalCasedName = inflector.camelize(name, false);
    if (name !== pascalCasedName) {
      throw new Error(`The resource's name "${name}" has to be in "Pascal" case: "${pascalCasedName}".`);
    }

    config.hooks && this.onConfig(config.hooks);
  }

  @Memoize()
  public toString(): string {
    return this.name;
  }

  @Memoize()
  public get plural(): string {
    const plural =
      typeof this.config.plural === 'string' && this.config.plural
        ? this.config.plural
        : inflector.pluralize(this.name);

    const pascalCasedPlural = inflector.camelize(plural, false);
    if (plural !== pascalCasedPlural) {
      throw new Error(`The resource's plural "${plural}" has to be in "Pascal" case: "${pascalCasedPlural}".`);
    }

    if (plural === this.name) {
      throw new Error(
        `The singular "${this.name}" and plural "${plural}" forms of a resource have to be different, you should define it with the "plural" parameter.`,
      );
    }

    return plural;
  }

  @Memoize()
  public get camelCasedName(): string {
    return inflector.camelize(this.name, true);
  }

  @Memoize()
  public get camelCasedPlural(): string {
    return inflector.camelize(this.plural, true);
  }

  @Memoize()
  public get description(): string | undefined {
    return typeof this.config.description === 'string' && this.config.description ? this.config.description : undefined;
  }

  @Memoize()
  public get filter(): (context: Context) => MaybePromise<Maybe<ResourceFilterValue>> {
    const filter = this.config.filter;
    if (filter != null) {
      return typeof filter === 'object' || filter === false ? () => filter : filter;
    }

    return () => undefined;
  }

  @Memoize()
  public getFieldMap(): FieldMap {
    const fieldMap = new FieldMap();
    for (const [name, config] of loadModuleMap(this.config.fields)) {
      fieldMap.set(name, new Field(name, config, this));
    }

    return fieldMap;
  }

  @Memoize()
  public getFieldSet(): FieldSet {
    return new FieldSet(this.getFieldMap().values());
  }

  @Memoize()
  public getRelationMap(): RelationMap {
    const relationMap = new RelationMap();
    for (const [name, config] of loadModuleMap(this.config.relations)) {
      const field = this.getFieldMap().get(name);
      if (field) {
        throw new Error(`The relation "${this}.${name}" cannot have the same name than the field "${field}".`);
      }

      relationMap.set(name, new Relation(name, config, this));
    }

    return relationMap;
  }

  @Memoize()
  public getRelationSet(): RelationSet {
    return new RelationSet(this.getRelationMap().values());
  }

  @Memoize()
  public getComponentMap(): ComponentMap {
    const componentMap = new ComponentMap<Field | Relation>([...this.getFieldMap(), ...this.getRelationMap()]);
    if (componentMap.size === 0) {
      throw new Error(`At least one component (= a field or a relation) has to be defined in the resource "${this}".`);
    }

    return componentMap;
  }

  @Memoize()
  public getComponentSet(): ComponentSet {
    return new ComponentSet(this.getComponentMap().values());
  }

  @Memoize((hookKind: ResourceHookKind) => hookKind)
  public hasPreHook(
    hookKind: ResourceHookKind.PreCreate | ResourceHookKind.PreUpdate | ResourceHookKind.PreDelete,
  ): boolean {
    return (
      this.getEventListenerCount(hookKind) > 0 ||
      (ResourceHookKind.PreDelete !== hookKind &&
        [...this.getComponentSet()].some(component => component.getEventListenerCount(hookKind) > 0))
    );
  }

  @Memoize((hookKind: ResourceHookKind) => hookKind)
  public hasPostHook(
    hookKind: ResourceHookKind.PostCreate | ResourceHookKind.PostUpdate | ResourceHookKind.PostDelete,
  ): boolean {
    return this.getEventListenerCount(hookKind) > 0;
  }

  public assertComponent<TComponent extends Component>(component: TComponent): TComponent {
    if (!this.getComponentSet().has(component)) {
      throw new Error(`The component "${component}" does not belong to the resource "${this}".`);
    }

    return component;
  }

  @Memoize()
  public getUniqueSet(): UniqueSet {
    const uniqueSet = new UniqueSet((this.config.uniques || []).map(config => new Unique(config, this)));

    if (uniqueSet.size === 0) {
      throw new Error(`At least one unique constraint has to be defined in the resource "${this}".`);
    }

    if (!uniqueSet.some(unique => unique.isPublic())) {
      throw new Error(
        `At least one "public" unique constraint (= with all its components "public") has to be defined in the resource "${this}".`,
      );
    }

    return uniqueSet;
  }

  @Memoize()
  public getNonNullableUniqueSet(): UniqueSet {
    return this.getUniqueSet().filter(unique => !unique.isNullable());
  }

  @Memoize()
  public getPublicUniqueSet(): UniqueSet {
    return this.getUniqueSet().filter(unique => unique.isPublic());
  }

  @Memoize()
  public getIdentifier(): Unique {
    const identifier = this.getUniqueSet().first(true);

    for (const component of identifier.componentSet) {
      if (component instanceof Relation && component.getTo() === this) {
        throw new Error(
          `A circular reference has been detected as the "${this}"'s identifier (= the first unique constraint) references itself in "${component.name}".`,
        );
      }
    }

    return identifier;
  }

  @Memoize()
  public getFirstPublicUnique(): Unique {
    return this.getPublicUniqueSet().first(true);
  }

  @Memoize()
  public getInverseRelationMap(): InverseRelationMap {
    const inverseRelationMap = new InverseRelationMap();
    for (const resource of this.gp.getResourceMap().values()) {
      for (const relation of resource.getRelationMap().values()) {
        if (relation.getTo() === this) {
          const inverseRelation = relation.getInverse();

          const component = this.getComponentMap().get(inverseRelation.name);
          if (component) {
            throw new Error(
              `The "${relation}"'s inverse relation cannot have the same name than the component "${component}", you may want to define the "inversedBy" property.`,
            );
          }

          const previousInverseRelation = inverseRelationMap.get(inverseRelation.name);
          if (previousInverseRelation) {
            throw new Error(
              `The "${relation}"'s inverse relation cannot have the same name than the "${previousInverseRelation.getInverse()}"'s inverse relation, you may want to define the "inversedBy" property.`,
            );
          }

          inverseRelationMap.set(inverseRelation.name, inverseRelation);
        }
      }
    }

    return inverseRelationMap;
  }

  @Memoize()
  public getInverseRelationSet(): InverseRelationSet {
    return new InverseRelationSet(this.getInverseRelationMap().values());
  }

  @Memoize()
  public isImmutable(): boolean {
    return getFlagValue(this.config.immutable, false);
  }

  public getOperationConstructorMap<TType extends OperationType>(type: TType): OperationConstructorMap<TType> {
    if (!(type in operationTypeMap && operationTypeMap[type])) {
      throw new Error(
        `The operation type "${type}" does not exist, please choose among "${Object.keys(operationTypeMap).join(
          ', ',
        )}".`,
      );
    }

    return operationTypeMap[type] as any;
  }

  public getOperationConstructor<TType extends OperationType, TId extends OperationId<TType>>(
    type: TType,
    id: TId,
  ): OperationConstructor<TType, TId> {
    const constructorMap = this.getOperationConstructorMap(type);

    if (!(id in constructorMap && constructorMap[id])) {
      throw new Error(
        `The ${type} "${id}" does not exist, please choose among "${Object.keys(constructorMap).join(', ')}".`,
      );
    }

    return constructorMap[id] as any;
  }

  @Memoize((type: OperationType, id: string) => [type, id].join('|'))
  public getOperation<
    TType extends OperationType = OperationType,
    TId extends OperationId<TType> = OperationId<TType>,
    TConstructor extends OperationConstructor<TType, TId> = OperationConstructor<TType, TId>
  >(type: TType, id: TId): InstanceType<TConstructor> {
    const constructor = this.getOperationConstructor(type, id);

    return new constructor(type, id, this);
  }

  public getMutation<TId extends OperationId<GraphQLOperationType.Mutation>>(id: TId) {
    return this.getOperation(GraphQLOperationType.Mutation, id);
  }

  public getQuery<TId extends OperationId<GraphQLOperationType.Query>>(id: TId) {
    return this.getOperation(GraphQLOperationType.Query, id);
  }

  public getOperationTypes(): OperationType[] {
    return getPlainObjectKeys(operationTypeMap);
  }

  public getOperationIds<TType extends OperationType>(type: TType): OperationId<TType>[] {
    const constructorMap = this.getOperationConstructorMap(type);

    return getPlainObjectKeys(constructorMap);
  }

  public getOperations(type?: OperationType): Operation[] {
    const operations: Operation[] = [];

    const types: OperationType[] = type ? [type] : this.getOperationTypes();
    for (const type of types) {
      for (const id of this.getOperationIds(type)) {
        operations.push(this.getOperation(type, id));
      }
    }

    return operations;
  }

  @Memoize((id: string) => id)
  public getInputType<
    TId extends InputTypeId = InputTypeId,
    TConstructor extends InputTypeConstructor<TId> = InputTypeConstructor<TId>
  >(id: TId): InstanceType<TConstructor> {
    if (!(id in inputTypeMap && inputTypeMap[id])) {
      throw new Error(
        `The input type "${id}" does not exist, please choose among "${Object.keys(inputTypeMap).join(', ')}".`,
      );
    }

    return new (inputTypeMap[id] as TConstructor)(id, this);
  }

  @Memoize((id: string) => id)
  public getOutputType<
    TId extends OutputTypeId = OutputTypeId,
    TConstructor extends OutputTypeConstructor<TId> = OutputTypeConstructor<TId>
  >(id: TId): InstanceType<TConstructor> {
    if (!(id in outputTypeMap && outputTypeMap[id])) {
      throw new Error(
        `The output type "${id}" does not exist, please choose among "${Object.keys(outputTypeMap).join(', ')}".`,
      );
    }

    return new (outputTypeMap[id] as TConstructor)(id, this);
  }

  @Memoize()
  public getVirtualFieldMap(): VirtualFieldMap {
    const virtualFieldMap = new VirtualFieldMap();

    if (this.config.virtualFields) {
      for (const [name, config] of loadModuleMap(
        typeof this.config.virtualFields === 'function'
          ? this.config.virtualFields({ resource: this })
          : this.config.virtualFields,
      )) {
        const component = this.getComponentMap().get(name);
        if (component) {
          throw new Error(
            `The virtual field "${this}.${name}" cannot have the same name than the component "${component}".`,
          );
        }

        const inverseRelation = this.getInverseRelationMap().get(name);
        if (inverseRelation) {
          throw new Error(
            `The virtual field "${this}.${name}" cannot have the same name than the "${inverseRelation.getInverse()}"'s inverse relation.`,
          );
        }

        virtualFieldMap.set(
          name,
          new VirtualField(name, typeof config === 'function' ? config({ resource: this }) : config, this),
        );
      }
    }

    return virtualFieldMap;
  }

  @Memoize()
  public getVirtualFieldSet(): VirtualFieldSet {
    return new VirtualFieldSet(this.getVirtualFieldMap().values());
  }

  public assertValue(node: unknown, normalized?: boolean, componentSet?: ComponentSet): NodeValue {
    if (isPlainObject(node)) {
      const strict = typeof componentSet !== 'undefined';

      return fromEntries(
        [...(componentSet || this.getComponentSet())].map(component => [
          component.name,
          typeof node[component.name] !== 'undefined' || strict
            ? component.isField()
              ? component.assertValue(node[component.name])
              : component.assertValue(node[component.name], normalized)
            : undefined,
        ]),
      );
    }

    throw new InvalidNodeValueError(this, `a plain object is expected but received "${node}" instead`);
  }

  public serializeValue(node: NodeValue, normalized?: boolean, componentSet?: ComponentSet): SerializedNodeValue {
    const strict = typeof componentSet !== 'undefined';

    return fromEntries(
      [...(componentSet || this.getComponentSet())].map(component => [
        component.name,
        typeof node[component.name] !== 'undefined' || strict
          ? component.isField()
            ? component.serializeValue(node[component.name] as FieldValue)
            : component.serializeValue(node[component.name] as RelationValue, normalized)
          : undefined,
      ]),
    );
  }

  public parseValue(node: SerializedNodeValue, normalized?: boolean, componentSet?: ComponentSet): NodeValue {
    const strict = typeof componentSet !== 'undefined';

    return fromEntries(
      [...(componentSet || this.getComponentSet())].map(component => [
        component.name,
        typeof node[component.name] !== 'undefined' || strict
          ? component.isField()
            ? component.parseValue(node[component.name] as SerializedFieldValue)
            : component.parseValue(node[component.name] as SerializedRelationValue, normalized)
          : undefined,
      ]),
    );
  }

  public assertId(id: unknown): WhereUniqueInputValue {
    return this.getInputType('WhereUnique').assert(id);
  }

  public serializeId(id: WhereUniqueInputValue): SerializedWhereUniqueInputValue {
    return this.serializeValue(this.assertId(id));
  }

  public parseId(node: SerializedWhereUniqueInputValue): WhereUniqueInputValue {
    return this.assertId(this.parseValue(node));
  }
}

export type AnyResource = Resource<any>;
