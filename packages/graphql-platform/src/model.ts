import {
  addPath,
  didYouMean,
  getOptionalFlag,
  isNonEmptyArray,
  isNonEmptyPlainObject,
  isPlainObject,
  MaybePathAwareError,
  OptionalFlag,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { assertValidName } from 'graphql';
import { camelize, pluralize } from 'inflection';
import { Subject } from 'rxjs';
import { Promisable } from 'type-fest';
import { GraphQLPlatform } from '.';
import {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from './connector';
import {
  catchDefinitionError,
  ComponentDefinitionError,
  ModelDefinitionError,
  ReferrerDefinitionError,
  UniqueConstraintDefinitionError,
} from './errors';
import {
  Component,
  ComponentConfig,
  Leaf,
  Reference,
} from './model/components';
import {
  CreateOperationConfig,
  DeleteOperationConfig,
  NodeChange,
  Operation,
  operationConstructorMap,
  OperationContext,
  OperationKey,
  OperationMap,
  UpdateOperationConfig,
} from './model/operations';
import { Referrer, ReferrerConfig } from './model/referrer';
import { CreationInput } from './model/types/inputs/creation';
import { OrderByInputType } from './model/types/inputs/order-by';
import { UpdateInput } from './model/types/inputs/update';
import {
  FilterValue,
  WhereInput,
  WhereInputValue,
} from './model/types/inputs/where';
import { WhereUniqueInput } from './model/types/inputs/where-unique';
import {
  NodeIdentifier,
  NodeRecord,
  NodeSelection,
  NodeType,
  NodeTypeConfig,
} from './model/types/node';
import {
  UniqueConstraint,
  UniqueConstraintConfig,
} from './model/unique-constraint';

export * from './model/components';
export * from './model/operations';
export * from './model/referrer';
export * from './model/types';
export * from './model/unique-constraint';

export type ModelAPI<TRequestContext, TConnector extends ConnectorInterface> = {
  [TKey in OperationKey]: Operation<
    TKey,
    TRequestContext,
    TConnector
  >['execute'];
};

export type ModelConfig<
  TRequestContext = undefined,
  TConnector extends ConnectorInterface = any,
> = {
  /**
   * Optional, either the model is exposed publicly (in the GraphQL API) or not (only available internally)
   *
   * Default: its GraphQL Platform's visibility
   */
  public?: OptionalFlag;

  /**
   * Optional, you can provide this model's plural form if the one guessed is not what you expect
   *
   * Default: guessed from the name
   */
  plural?: string;

  /**
   * Optional, provide a description for this model
   */
  description?: string;

  /**
   * Optional, either this model is deprecated or not
   *
   * The information will be shown in all its operations
   */
  deprecated?: boolean | string;

  /**
   * Optional, either this models' record is immutable or not
   *
   * Default: false
   */
  immutable?: OptionalFlag;

  /**
   * A component is either a leaf (= an enum or a scalar) or a reference (= another node's id)
   *
   * At least one must be defined
   */
  components: {
    /**
     * The components' name are expected to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [componentName: string]: ComponentConfig<TRequestContext, TConnector>;
  };

  /**
   * Define the unique constraints for this model
   *
   * At least one must be defined
   *
   * The first one will become this model's identifier, a special unique constraint with some additional restrictions, it must be:
   *  - non-nullable (= at least one of its components being non-nullable)
   *  - immutable (= all its components being immutable)
   */
  uniques: UniqueConstraintConfig<TConnector>[];

  /**
   * Optional, define some referrers
   */
  referrers?: {
    /**
     * The referrer' name are expected to be valid against the GraphQL "Names" rules
     *
     * @see https://spec.graphql.org/draft/#sec-Names
     */
    [referrerName: string]: ReferrerConfig<TRequestContext, TConnector>;
  };

  /**
   * Optional, fine-tune the output type
   */
  node?: NodeTypeConfig<TRequestContext, TConnector>;

  /**
   * Optional, fine-tune the access by providing a filter (= the "where" argument) which will be appended to all the clients' requests:
   *
   * - "undefined" or "true" means no filter is appended
   * - "null" or "false" means no node is returned
   * - "a valid filter" means it will applied in a logical "AND" like: { AND: ["THE GENERATED FILTER", "THE CLIENT FILTER"] }
   */
  filter?: (
    operationContext: OperationContext<TRequestContext, TConnector>,
  ) => Promisable<WhereInputValue>;

  /**
   * Optional, fine-tune the mutations
   */
  mutations?: {
    /**
     * Optional, fine-tune the "create" mutations
     */
    create?: CreateOperationConfig<TRequestContext, TConnector>;

    /**
     * Optional, fine-tune the "update" mutations
     */
    update?: UpdateOperationConfig<TRequestContext, TConnector>;

    /**
     * Optional, fine-tune the "delete" mutations
     *
     */
    delete?: DeleteOperationConfig<TRequestContext, TConnector>;
  };

  /**
   * Optional, act on nodes' changes
   */
  onChange?: (
    change: NodeChange<TRequestContext, TConnector>,
  ) => Promisable<void>;
} & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.Model>;

export class Model<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly public: boolean;
  public readonly plural: string;
  public readonly description: string | undefined;
  public readonly deprecationReason: string | undefined;
  public readonly immutable: boolean;
  public readonly componentMap: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector>
  >;
  public readonly leafMap: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector>
  >;
  public readonly referenceMap: ReadonlyMap<
    Reference['name'],
    Reference<TRequestContext, TConnector>
  >;
  public readonly uniqueConstraintMap: ReadonlyMap<
    UniqueConstraint['name'],
    UniqueConstraint<TRequestContext, TConnector>
  >;
  public readonly identifier: UniqueConstraint<TRequestContext, TConnector>;

  /**
   * An Observable of the nodes' changes
   */
  public readonly changes = new Subject<
    NodeChange<TRequestContext, TConnector>
  >();

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,
    public readonly name: string,
    public readonly config: ModelConfig<TRequestContext, TConnector>,
  ) {
    // name
    {
      catchDefinitionError(
        () => assertValidName(name),
        (error) =>
          new ModelDefinitionError(
            name,
            `expects a name valid against the GraphQL rules`,
            error,
          ),
      );

      const pascalCasedName = camelize(name, false);
      if (name !== pascalCasedName) {
        throw new ModelDefinitionError(
          name,
          `expects a name in "PascalCase" (= "${pascalCasedName}")`,
        );
      }
    }

    // visibility
    {
      this.public = catchDefinitionError(
        () => getOptionalFlag(config.public, gp.public),
        (error) =>
          new ModelDefinitionError(name, `expects a valid public value`, error),
      );

      if (this.public && !gp.public) {
        throw new ModelDefinitionError(
          name,
          `expects not to be public as the GraphQL Platform is not`,
        );
      }
    }

    // plural
    {
      this.plural = catchDefinitionError(
        () => assertValidName(config.plural ?? pluralize(name)),
        (error) =>
          new ModelDefinitionError(
            name,
            `expects a plural form valid against the GraphQL rules`,
            error,
          ),
      );

      const pascalCasedPlural = camelize(this.plural, false);
      if (this.plural !== pascalCasedPlural) {
        throw new ModelDefinitionError(
          name,
          `expects a plural form in "PascalCase" (= "${pascalCasedPlural}"), got "${this.plural}"`,
        );
      }

      if (name === this.plural) {
        throw new ModelDefinitionError(
          name,
          `expects differents name and plural forms, you have to define the plural parameter as we were not able to guess a valid one`,
        );
      }
    }

    // description
    this.description = config.description || undefined;

    // deprecation reason
    this.deprecationReason =
      config.deprecated === true
        ? `The "${name}" model is deprecated, all its operations will be removed`
        : config.deprecated || undefined;

    // immutable
    this.immutable = catchDefinitionError(
      () => getOptionalFlag(config.immutable, false),
      (error) =>
        new ModelDefinitionError(
          this,
          `expects a valid immutable value`,
          error,
        ),
    );

    // components
    {
      if (!isNonEmptyPlainObject(config.components)) {
        throw new ModelDefinitionError(
          name,
          `expects at least one component to be defined`,
        );
      }

      this.componentMap = new Map(
        Object.entries(config.components).map(([name, config]) => [
          name,
          // Catch the "uncaught" errors
          catchDefinitionError(
            () =>
              config.kind === 'Leaf'
                ? new Leaf(this, name, config)
                : new Reference(this, name, config),
            (error) => new ComponentDefinitionError(`${this}.${name}`, error),
          ),
        ]),
      );

      this.leafMap = new Map(
        [...this.componentMap].filter(
          (entry): entry is [string, Leaf<TRequestContext, TConnector>] =>
            entry[1] instanceof Leaf,
        ),
      );

      this.referenceMap = new Map(
        [...this.componentMap].filter(
          (entry): entry is [string, Reference<TRequestContext, TConnector>] =>
            entry[1] instanceof Reference,
        ),
      );
    }

    // unique constraints
    {
      if (!isNonEmptyArray(config.uniques)) {
        throw new ModelDefinitionError(
          name,
          `expects at least one "unique constraint" to be defined`,
        );
      }

      this.uniqueConstraintMap = new Map(
        config.uniques.map((config, index) => {
          // Catch the "uncaught" errors
          const unique = catchDefinitionError(
            () => new UniqueConstraint(this, config),
            (error) =>
              new UniqueConstraintDefinitionError(`${name}.${index}`, error),
          );

          return [unique.name, unique];
        }),
      );

      // identifier (= the first unique constraint)
      {
        this.identifier = [...this.uniqueConstraintMap.values()][0];

        if (this.identifier.nullable) {
          throw new ModelDefinitionError(
            name,
            `expects its identifier (= the first "unique constraint") to be non-nullable (= at least one of its components being non-nullable)`,
          );
        }

        if (!this.identifier.immutable) {
          throw new ModelDefinitionError(
            name,
            `expects its identifier (= the first "unique constraint") to be immutable (= all its components being immutable)`,
          );
        }
      }
    }

    if (this.public) {
      if (
        ![...this.componentMap.values()].some((component) => component.public)
      ) {
        throw new ModelDefinitionError(
          name,
          `expects at least one public component as it is public`,
        );
      }

      if (
        ![...this.uniqueConstraintMap.values()].some(
          (uniqueConstraint) => uniqueConstraint.public,
        )
      ) {
        throw new ModelDefinitionError(
          name,
          `expects at least one public unique constraint as it is public`,
        );
      }
    }

    config.onChange && this.changes.subscribe(config.onChange);
  }

  public toString(): string {
    return this.name;
  }

  public getComponent(
    name: string,
    path?: Path,
  ): Component<TRequestContext, TConnector> {
    const component = this.componentMap.get(name);
    if (!component) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the component "${name}", did you mean: ${didYouMean(
          name,
          this.componentMap.keys(),
        )}`,
        path,
      );
    }

    return component;
  }

  public getLeaf(name: string, path?: Path): Leaf<TRequestContext, TConnector> {
    const leaf = this.leafMap.get(name);
    if (!leaf) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the leaf "${name}", did you mean: ${didYouMean(
          name,
          this.leafMap.keys(),
        )}`,
        path,
      );
    }

    return leaf;
  }

  public getReference(
    name: string,
    path?: Path,
  ): Reference<TRequestContext, TConnector> {
    const reference = this.referenceMap.get(name);
    if (!reference) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the reference "${name}", did you mean: ${didYouMean(
          name,
          this.referenceMap.keys(),
        )}`,
        path,
      );
    }

    return reference;
  }

  public getUniqueConstraint(
    name: string,
    path?: Path,
  ): UniqueConstraint<TRequestContext, TConnector> {
    const uniqueConstraint = this.uniqueConstraintMap.get(name);
    if (!uniqueConstraint) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the unique constraint "${name}", did you mean: ${didYouMean(
          name,
          this.uniqueConstraintMap.keys(),
        )}`,
        path,
      );
    }

    return uniqueConstraint;
  }

  @Memoize()
  public get referrerMap(): ReadonlyMap<
    Referrer['name'],
    Referrer<TRequestContext, TConnector>
  > {
    if (this.config.referrers !== undefined) {
      if (!isPlainObject(this.config.referrers)) {
        throw new ModelDefinitionError(
          this,
          'expects the "referrers" to be provided as a plain object',
        );
      }

      return new Map(
        Object.entries(this.config.referrers).map(([name, config]) => {
          const referrer = catchDefinitionError(
            () => new Referrer(this, name, config),
            (error) => new ReferrerDefinitionError(`${this}.${name}`, error),
          );

          if (this.componentMap.has(name)) {
            throw new ReferrerDefinitionError(
              referrer,
              `expects a "name" not among "${[...this.componentMap.keys()].join(
                ', ',
              )}", got "${name}"`,
            );
          }

          return [name, referrer];
        }),
      );
    }

    return new Map();
  }

  public getReferrer(
    name: string,
    path?: Path,
  ): Referrer<TRequestContext, TConnector> {
    const reverseEdge = this.referrerMap.get(name);
    if (!reverseEdge) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the referrer "${name}", did you mean: ${didYouMean(
          name,
          this.referrerMap.keys(),
        )}`,
        path,
      );
    }

    return reverseEdge;
  }

  public validate(): void {
    this.componentMap.forEach((component) =>
      catchDefinitionError(
        () => component.validate(),
        (error) => new ComponentDefinitionError(component, error),
      ),
    );

    this.uniqueConstraintMap.forEach((uniqueConstraint) =>
      catchDefinitionError(
        () => uniqueConstraint.validate(),
        (error) => new UniqueConstraintDefinitionError(uniqueConstraint, error),
      ),
    );

    // Resolves the "lazy" properties
    this.referrerMap;
  }

  @Memoize()
  public get orderByInputType(): OrderByInputType {
    return new OrderByInputType(this);
  }

  @Memoize()
  public get whereUniqueInputType(): WhereUniqueInput {
    return new WhereUniqueInput(this);
  }

  @Memoize()
  public get whereInputType(): WhereInput {
    return new WhereInput(this);
  }

  @Memoize()
  public get creationInputType(): CreationInput {
    return new CreationInput(this);
  }

  @Memoize()
  public get updateInputType(): UpdateInput {
    return new UpdateInput(this);
  }

  @Memoize()
  public get nodeType(): NodeType {
    return new NodeType(this);
  }

  @Memoize()
  public get identifierSelection(): NodeSelection {
    return this.identifier.selection;
  }

  public assertIdentifier(
    maybeIdentifier: unknown,
    path: Path = addPath(undefined, this.name),
  ): NodeIdentifier {
    return this.identifier.selection.assertValue(maybeIdentifier, path);
  }

  @Memoize()
  public get recordSelection(): NodeSelection {
    return new NodeSelection(
      this.nodeType,
      Array.from(this.componentMap.values(), ({ selection }) => selection),
    );
  }

  public assertRecord(
    maybeRecord: unknown,
    path: Path = addPath(undefined, this.name),
  ): NodeRecord {
    return this.recordSelection.assertValue(maybeRecord, path);
  }

  @Memoize()
  public get operationMap(): OperationMap<TRequestContext, TConnector> {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(operationConstructorMap).map(([key, Constructor]) => [
          key,
          new Constructor(this),
        ]),
      ) as OperationMap,
    );
  }

  public getOperation<TKey extends OperationKey>(
    key: TKey,
    path?: Path,
  ): Operation<TKey, TRequestContext, TConnector> {
    if (!this.operationMap[key]) {
      throw new MaybePathAwareError(
        `The "${this}" model does not contain the operation "${key}", did you mean: ${didYouMean(
          String(key),
          Object.keys(this.operationMap),
        )}`,
        path,
      );
    }

    return this.operationMap[key];
  }

  @Memoize()
  public get api(): ModelAPI<TRequestContext, TConnector> {
    return new Proxy({} as any, {
      get:
        (_, operationKey: OperationKey) =>
        (...params: any[]) =>
          this.getOperation<any>(operationKey).execute(...params),
    });
  }

  /**
   * Given a filter, appends the one configured to produce the one actually provided to the connector
   */
  public async getContextualizedFilter(
    where: WhereInputValue,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<FilterValue> {
    return this.whereInputType.parseValue(
      { AND: [await this.config.filter?.(context), where] },
      path,
    );
  }

  /**
   * Given a node selection, returns a new one with contextualized filter where it matters
   */
  public async getContextualizedSelection(
    selection: NodeSelection,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<NodeSelection> {
    return selection;

    // return {
    //   ...selection,
    //   fields: await Promise.all(
    //     selection.fields.map(
    //       async (field): Promise<FieldSelection> => {
    //         switch (field.kind) {
    //           // case 'Edge':
    //           // case 'EdgeExistence':
    //           //   break;

    //           default:
    //             return field;
    //         }
    //       },
    //     ),
    //   ),
    // };

    // return Promise.all(
    //   selections.map(async (selection) => {
    //     switch (selection.kind) {
    //       case 'Edge':
    //       case 'EdgeExistence':
    //       case 'ReverseEdge':
    //       case 'ReverseEdgeCount':
    //       case 'UniqueReverseEdge':
    //       case 'UniqueReverseEdgeExistence': {
    //         const selectedNode = getSelectedNode(this, selection);

    //         const contextualizedFilter = await selectedNode.getContextualizedFilter(
    //           selection.args?.filter,
    //           context,
    //           addPath(path, getSelectionKey(selection)),
    //         );

    //         const args = normalizeObject({
    //           ...getNormalizedSelectionArgs(selection),
    //           filter:
    //             contextualizedFilter.kind === 'Boolean' &&
    //             contextualizedFilter.value
    //               ? undefined
    //               : contextualizedFilter,
    //         });

    //         return <TNodeOutputSelection>{
    //           ...selection,
    //           ...(args && { args }),
    //           ...('selections' in selection && {
    //             selections: await selectedNode.getContextualizedSelections(
    //               selection.selections,
    //               context,
    //               addPath(path, getSelectionKey(selection)),
    //             ),
    //           }),
    //         };
    //       }

    //       default:
    //         return selection;
    //     }
    //   }),
    // );
  }
}
