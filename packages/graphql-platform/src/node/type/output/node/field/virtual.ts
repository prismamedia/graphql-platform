import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { Except, Promisable } from 'type-fest';
import type { BrokerInterface } from '../../../../../broker-interface.js';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { Node } from '../../../../../node.js';
import type { OperationContext } from '../../../../operation.js';
import {
  VirtualSelection,
  type NodeSelectedSource,
  type NodeSelectedValue,
  type NodeSelection,
} from '../../../../statement.js';
import type {
  GraphQLSelectionContext,
  NodeOutputType,
  PartialGraphQLResolveInfo,
  RawNodeSelection,
} from '../../node.js';
import { AbstractFieldOutputType } from '../abstract-field.js';

export interface VirtualOutputConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TSource extends NodeSelectedSource = any,
  TArgs = any,
  TResult = unknown,
> {
  /**
   * Optional, provide a description for this virtual-field
   */
  description?: utils.OptionalDescription;

  /**
   * Optional, either this virtual-field is deprecated or not
   */
  deprecated?: utils.OptionalDeprecation;

  /**
   * Optional, either this virtual-field is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   */
  public?: utils.OptionalFlag;

  /**
   * Optional, the definition of the arguments this virtual-field accepts
   */
  args?: Record<
    utils.InputConfig['name'],
    utils.Nillable<Except<utils.InputConfig, 'name'>>
  >;

  /**
   * Required, the output type of this virtual-field
   */
  type: graphql.GraphQLOutputType;

  /**
   * Optional, in order to compute this virtual-field value, you certainly need some other fields' value in the resolver's source (= its first argument),
   * you can configure the dependency here, as a fragment/selectionSet
   *
   * Example: '{ id title }'
   */
  dependsOn?: utils.Thunkable<
    RawNodeSelection<TSource>,
    [field: VirtualOutputType]
  >;

  /**
   * Required, using the source, arguments, and request context, the resolver produces a value that is valid against the type defined above
   */
  resolve: (
    this: Node<TRequestContext, TConnector, TBroker, TContainer>,
    source: TSource,
    args: TArgs,
    context: OperationContext<TRequestContext, TConnector, TBroker, TContainer>,
    info: PartialGraphQLResolveInfo,
  ) => Promisable<TResult>;
}

export type ThunkableNillableVirtualOutputConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TSource extends NodeSelectedSource = any,
  TArgs = any,
  TResult = unknown,
> = utils.Thunkable<
  utils.Nillable<
    VirtualOutputConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer,
      TSource,
      TArgs,
      TResult
    >
  >,
  [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
>;

export type ThunkableNillableVirtualOutputConfigsByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  utils.Nillable<{
    [fieldName: utils.Name]: ThunkableNillableVirtualOutputConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >;
  }>,
  [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
>;

export class VirtualOutputType<
  TSource extends NodeSelectedValue | undefined = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = unknown,
> extends AbstractFieldOutputType<TArgs> {
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public readonly args?: ReadonlyArray<utils.Input>;
  public readonly type: graphql.GraphQLOutputType;
  public readonly namedType: graphql.GraphQLNamedOutputType;

  public readonly resolve: (
    source: TSource,
    args: TArgs,
    context: OperationContext,
    info: PartialGraphQLResolveInfo,
  ) => Promisable<TResult>;

  public constructor(
    public readonly parent: NodeOutputType,
    public readonly name: utils.Name,
    public readonly config: VirtualOutputConfig,
    public readonly configPath?: utils.Path,
  ) {
    super();

    utils.assertName(name, configPath);

    this.description = utils.getOptionalDescription(
      config.description,
      utils.addPath(configPath, 'description'),
    );

    this.deprecationReason = utils.getOptionalDeprecation(
      config.deprecated,
      `The "${name}" virtual-field is deprecated`,
      utils.addPath(configPath, 'deprecated'),
    );

    // args
    {
      const argsConfig = config.args;
      const argsConfigPath = utils.addPath(configPath, 'args');

      utils.assertNillablePlainObject(argsConfig, argsConfigPath);

      const inputs: utils.Input[] = [];

      if (argsConfig) {
        for (const [name, config] of Object.entries(argsConfig)) {
          if (config) {
            const configPath = utils.addPath(argsConfigPath, name);

            inputs.push(new utils.Input({ name, ...config }, configPath));
          }
        }
      }

      this.args = inputs.length ? inputs : undefined;
    }

    this.type = config.type;
    this.namedType = graphql.getNamedType(config.type);

    this.resolve = utils
      .ensureFunction(config.resolve, utils.addPath(configPath, 'resolve'))
      .bind(parent.node);
  }

  @Memoize()
  public override isPublic(): boolean {
    const config = this.config.public;
    const configPath = utils.addPath(this.configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      config,
      this.parent.node.isPublic(),
      configPath,
    );

    if (isPublic && !this.parent.node.isPublic()) {
      throw new utils.UnexpectedValueError(
        `not to be "true" as the "${this.parent.node}" node is private`,
        config,
        { path: configPath },
      );
    }

    return isPublic;
  }

  @Memoize()
  public get dependencies(): NodeSelection | undefined {
    const config = this.config.dependsOn;
    const configPath = utils.addPath(this.configPath, 'dependsOn');

    if (config) {
      const selection = this.parent.select(
        utils.resolveThunkable(config, this),
        undefined,
        undefined,
        configPath,
      );

      if (selection.hasVirtualSelection) {
        throw new utils.GraphError(`Expects not to depends on virtual-fields`, {
          path: configPath,
        });
      }

      return selection;
    }
  }

  @Memoize()
  public override validate(): void {
    super.validate();

    this.dependencies;
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    _operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): VirtualSelection {
    const args = this.parseGraphQLArgumentNodes(
      ast.arguments,
      selectionContext,
      path,
    );

    return new VirtualSelection(this, ast.alias?.value, args, {
      fieldNodes: [ast],
      returnType: this.type,
      path,
      fragments: selectionContext?.fragments ?? {},
      variableValues: selectionContext?.variableValues ?? {},
    });
  }

  public selectShape(
    value: unknown,
    _operationContext: OperationContext | undefined,
    path: utils.Path,
  ): never {
    throw new utils.UnexpectedValueError('not to be selected', value, { path });
  }
}
