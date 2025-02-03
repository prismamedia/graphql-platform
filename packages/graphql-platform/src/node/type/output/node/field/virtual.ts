import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
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
   * Optional, either this virtual-field is exposed publicly (in the GraphQL API) or not (only available in the internal API)
   */
  public?: utils.Thunkable<
    utils.OptionalFlag,
    [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
  >;

  /**
   * Optional, provide a description for this virtual-field
   */
  description?: utils.Thunkable<
    utils.OptionalDescription,
    [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
  >;

  /**
   * Optional, either this virtual-field is deprecated or not
   */
  deprecated?: utils.Thunkable<
    utils.OptionalDeprecation,
    [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
  >;

  /**
   * Optional, the definition of the arguments this virtual-field accepts
   */
  args?: utils.Thunkable<
    | ReadonlyArray<utils.Input>
    | Record<
        utils.InputConfig['name'],
        utils.Nillable<Except<utils.InputConfig, 'name'>>
      >,
    [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
  >;

  /**
   * Required, the output type of this virtual-field
   */
  type: utils.Thunkable<
    graphql.GraphQLOutputType,
    [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
  >;

  /**
   * Optional, in order to compute this virtual-field value, you certainly need some other fields' value in the resolver's source (= its first argument),
   * you can configure the dependency here, as a fragment/selectionSet
   *
   * Example: '{ id title }'
   */
  dependsOn?:
    | utils.Nillable<RawNodeSelection<TSource>>
    | ((
        this: Node<TRequestContext, TConnector, TBroker, TContainer>,
        args: TArgs,
        info: PartialGraphQLResolveInfo,
      ) => utils.Nillable<RawNodeSelection<TSource>>);

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

export type ThunkableVirtualOutputConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TSource extends NodeSelectedSource = any,
  TArgs = any,
  TResult = unknown,
> = utils.Thunkable<
  VirtualOutputConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer,
    TSource,
    TArgs,
    TResult
  >,
  [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
>;

export type ThunkableVirtualOutputConfigsByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  {
    [fieldName: utils.Name]: ThunkableVirtualOutputConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >;
  },
  [node: Node<TRequestContext, TConnector, TBroker, TContainer>]
>;

export class VirtualOutputType<
  TSource extends NodeSelectedValue | undefined = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = unknown,
> extends AbstractFieldOutputType<TArgs> {
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
    utils.assertName(name, configPath);
    utils.assertPlainObject(config, configPath);

    super();

    this.resolve = utils
      .ensureFunction(config.resolve, utils.addPath(configPath, 'resolve'))
      .bind(parent.node);
  }

  @MMethod()
  public override isPublic(): boolean {
    const config = this.config.public;
    const configPath = utils.addPath(this.configPath, 'public');

    const isPublic = utils.getOptionalFlag(
      utils.resolveThunkable(config, this.parent.node),
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

  @MGetter
  public get description(): string | undefined {
    return utils.getOptionalDescription(
      utils.resolveThunkable(this.config.description, this.parent.node),
      utils.addPath(this.configPath, 'description'),
    );
  }

  @MGetter
  public get deprecationReason(): string | undefined {
    return utils.getOptionalDeprecation(
      utils.resolveThunkable(this.config.deprecated, this.parent.node),
      `The "${this.name}" virtual-field is deprecated`,
      utils.addPath(this.configPath, 'deprecated'),
    );
  }

  @MGetter
  public get args(): ReadonlyArray<utils.Input> | undefined {
    const argsConfig = utils.resolveThunkable(
      this.config.args,
      this.parent.node,
    );
    const argsConfigPath = utils.addPath(this.configPath, 'args');

    utils.assertNillablePlainObject(argsConfig, argsConfigPath);

    if (argsConfig) {
      const inputs: utils.Input[] = [];

      if (Array.isArray(argsConfig)) {
        inputs.push(...argsConfig);
      } else {
        for (const [name, config] of Object.entries(argsConfig)) {
          if (config) {
            const configPath = utils.addPath(argsConfigPath, name);

            inputs.push(new utils.Input({ name, ...config }, configPath));
          }
        }
      }

      return inputs.length ? inputs : undefined;
    }
  }

  @MGetter
  public get type(): graphql.GraphQLOutputType {
    return utils.resolveThunkable(this.config.type, this.parent.node);
  }

  @MGetter
  public get namedType(): graphql.GraphQLNamedOutputType {
    return graphql.getNamedType(this.type);
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): VirtualSelection {
    const args = this.parseGraphQLArgumentNodes(
      ast.arguments,
      selectionContext,
      path,
    );

    const info: PartialGraphQLResolveInfo = {
      fieldNodes: [ast],
      returnType: this.type,
      path,
      fragments: selectionContext?.fragments ?? {},
      variableValues: selectionContext?.variableValues ?? {},
    };

    let sourceSelection: NodeSelection | undefined;

    // dependencies
    {
      const config = this.config.dependsOn;
      const configPath = utils.addPath(this.configPath, 'dependsOn');

      if (config) {
        const maybeDependency =
          typeof config === 'function'
            ? config.call(this.parent.node, args, info)
            : config;

        if (maybeDependency) {
          sourceSelection = this.parent.select(
            maybeDependency,
            operationContext,
            selectionContext,
            configPath,
          );
        }
      }
    }

    return new VirtualSelection(
      this,
      ast.alias?.value,
      args,
      info,
      sourceSelection,
    );
  }

  public selectShape(
    value: unknown,
    _operationContext: OperationContext | undefined,
    path: utils.Path,
  ): never {
    throw new utils.UnexpectedValueError('not to be selected', value, { path });
  }
}
