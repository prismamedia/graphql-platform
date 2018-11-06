import {
  FlagConfig,
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
import { BaseContext, Context, CustomContext, GraphQLPlatform } from '../graphql-platform';
import { ConnectorCreateInputValue, ConnectorUpdateInputValue } from './connector';
import {
  DeleteOneOperationArgs,
  Operation,
  OperationConstructor,
  OperationConstructorMap,
  OperationId,
  OperationType,
  operationTypeMap,
  OperationTypeMapConfig,
  UpdateOneOperationArgs,
} from './operation';
import { CreateOneOperationArgs } from './operation/mutation';
import { AnyRelationMap, AnyRelationSet } from './resource/any-relation';
import {
  ComponentMap,
  ComponentSet,
  ComponentValue,
  Field,
  FieldConfig,
  FieldMap,
  FieldSet,
  InverseRelationMap,
  InverseRelationSet,
  Relation,
  RelationConfig,
  RelationMap,
  RelationSet,
} from './resource/component';
import { ResourceMap } from './resource/map';
import { Unique, UniqueConfig, UniqueFullConfig, UniqueSet } from './resource/unique';
import { VirtualField, VirtualFieldConfig, VirtualFieldMap, VirtualFieldSet } from './resource/virtual-field';
import {
  InputTypeConstructor,
  InputTypeId,
  inputTypeMap,
  OutputTypeConstructor,
  OutputTypeId,
  outputTypeMap,
  WhereInputValue,
  WhereUniqueInputValue,
} from './type';

export * from './resource/any-relation';
export * from './resource/component';
export * from './resource/graph';
export * from './resource/map';
export * from './resource/set';
export * from './resource/unique';
export * from './resource/virtual-field';

export interface NodeValue {
  [componentName: string]: ComponentValue;
}

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
  TBaseContext extends BaseContext = any
> = {
  args: TArgs;
  context: Context<TCustomContext, TBaseContext>;
  resource: Resource;
};

export interface ResourceHookMap<TCustomContext extends CustomContext = any, TBaseContext extends BaseContext = any> {
  // Create
  [ResourceHookKind.PreCreate]: {
    metas: Readonly<ResourceHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext>>;
    create: ConnectorCreateInputValue;
  };
  [ResourceHookKind.PostCreate]: Readonly<{
    metas: Readonly<ResourceHookMetaMap<CreateOneOperationArgs, TCustomContext, TBaseContext>>;
    createdNodeId: WhereUniqueInputValue;
  }>;

  // Update
  [ResourceHookKind.PreUpdate]: {
    metas: Readonly<ResourceHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext>>;
    toBeUpdatedNodeId: WhereUniqueInputValue;
    update: ConnectorUpdateInputValue;
  };
  [ResourceHookKind.PostUpdate]: Readonly<{
    metas: Readonly<ResourceHookMetaMap<UpdateOneOperationArgs, TCustomContext, TBaseContext>>;
    updatedNodeId: WhereUniqueInputValue;
  }>;

  // Delete
  [ResourceHookKind.PreDelete]: {
    metas: Readonly<ResourceHookMetaMap<DeleteOneOperationArgs, TCustomContext, TBaseContext>>;
    toBeDeletedNodeId: WhereUniqueInputValue;
  };
  [ResourceHookKind.PostDelete]: Readonly<{
    metas: Readonly<ResourceHookMetaMap<DeleteOneOperationArgs, TCustomContext, TBaseContext>>;
    deletedNodeId: WhereUniqueInputValue;
  }>;
}

export enum ResourceEventKind {
  // Always triggered
  PreOperation = 'PRE_OPERATION',

  // Triggered on error only
  PostOperationError = 'POST_OPERATION_ERROR',

  // Triggered on success only
  PostOperationSuccess = 'POST_OPERATION_SUCCESS',

  // Always triggered
  PostOperation = 'POST_OPERATION',
}

export type ResourceOperationEvent<TBaseContext extends BaseContext = any, TOperationContext extends POJO = any> = {
  // The current operation
  operation: Operation;

  // The known GraphQL context, shared by all the resolvers of the same request
  context: TBaseContext;

  // A new context, shared only by this very resolver
  operationContext: TOperationContext;
};

export interface ResourceEventMap<TBaseContext extends BaseContext = any, TOperationContext extends POJO = any> {
  [ResourceEventKind.PreOperation]: Readonly<ResourceOperationEvent<TBaseContext, TOperationContext>>;
  [ResourceEventKind.PostOperationSuccess]: Readonly<ResourceOperationEvent<TBaseContext, TOperationContext>>;
  [ResourceEventKind.PostOperationError]: Readonly<
    ResourceOperationEvent<TBaseContext, TOperationContext> & { error: Error }
  >;
  [ResourceEventKind.PostOperation]: Readonly<ResourceOperationEvent<TBaseContext, TOperationContext>>;
}

export interface ResourceConfig<
  TCustomContext extends CustomContext = any,
  TBaseContext extends BaseContext = BaseContext,
  TFieldConfig extends FieldConfig = FieldConfig<TCustomContext, TBaseContext>,
  TRelationConfig extends RelationConfig = RelationConfig<TCustomContext, TBaseContext>,
  TUniqueFullConfig extends UniqueFullConfig = UniqueFullConfig
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

export class Resource<TConfig extends ResourceConfig<any, any> = ResourceConfig> extends EventEmitter<
  ResourceHookMap & ResourceEventMap
> {
  public constructor(readonly name: string, readonly config: TConfig, readonly gp: GraphQLPlatform) {
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
        throw new Error(
          `The relation "${name}" cannot be defined as the field "${field}" is already defined with the same name.`,
        );
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

  @Memoize()
  public getUniqueSet(): UniqueSet {
    const uniqueSet = new UniqueSet((this.config.uniques || []).map(config => new Unique(config, this)));

    if (uniqueSet.size === 0) {
      throw new Error(`At least one unique constraint has to be defined in the resource "${this}".`);
    }

    if (!uniqueSet.some(unique => unique.isPublic())) {
      throw new Error(
        `At least one public unique constraint (= with all its components public) has to be defined in the resource "${this}".`,
      );
    }

    return uniqueSet;
  }

  @Memoize()
  public getPublicUniqueSet(): UniqueSet {
    return this.getUniqueSet().filter(unique => unique.isPublic());
  }

  @Memoize()
  public getIdentifier(): Unique {
    const identifier = this.getUniqueSet().first();
    if (!identifier) {
      throw new Error(`At least one unique constraint has to be defined in the resource "${this}".`);
    }

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
    const firstPublicUnique = this.getPublicUniqueSet().first();
    if (!firstPublicUnique) {
      throw new Error(
        `At least one public unique constraint (= with all its components public) has to be defined in the resource "${this}".`,
      );
    }

    return firstPublicUnique;
  }

  @Memoize()
  public getInverseRelationMap(): InverseRelationMap {
    const inverseRelationMap = new InverseRelationMap();
    for (const resource of this.gp.getResourceMap().values()) {
      for (const relation of resource.getRelationMap().values()) {
        if (relation.getTo() === this) {
          const inverseRelation = relation.getInverse();
          if (this.getComponentMap().has(inverseRelation.name)) {
            throw new Error(
              `The "${relation}"'s inverse relation can't be named "${inverseRelation.name}", it already exists, you may want to define the "inversedBy".`,
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
  public getAnyRelationMap(): AnyRelationMap {
    return new AnyRelationMap([...this.getRelationMap(), ...this.getInverseRelationMap()]);
  }

  @Memoize()
  public getAnyRelationSet(): AnyRelationSet {
    return new AnyRelationSet(this.getAnyRelationMap().values());
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
            `The virtual field "${name}" cannot be defined as the component "${component}" is already defined with the same name.`,
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

  public parseValue(value: unknown): NodeValue | undefined {
    if (typeof value !== 'undefined') {
      if (isPlainObject(value)) {
        const node: NodeValue = Object.create(null);

        for (const component of this.getComponentSet()) {
          component.setValue(node, value[component.name]);
        }

        if (Object.keys(node).length === 0) {
          return undefined;
        }

        return node;
      }

      throw new Error(`The "${this}" node's value has to be a plain object: "${value}" given.`);
    }

    return undefined;
  }

  public isValue(value: unknown): value is NodeValue {
    return typeof this.parseValue(value) !== 'undefined';
  }
}
