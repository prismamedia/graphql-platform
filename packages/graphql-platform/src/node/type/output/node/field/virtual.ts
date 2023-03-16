import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { GPBoundGraphQLFieldConfig } from '../../../../../graphql-field-config.js';
import type { Node } from '../../../../../node.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../statement/selection.js';
import type { NodeOutputType, RawNodeSelection } from '../../node.js';

export interface VirtualFieldOutputConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
  TSource extends NodeSelectedValue = any,
  TArgs = any,
  TResult = unknown,
> extends GPBoundGraphQLFieldConfig<
    TRequestContext,
    TConnector,
    TContainer,
    TSource,
    TArgs,
    TResult
  > {
  /**
   * Optional, in order to compute this virtual field value, you certainly need some other fields' value in the resolver's source,
   * you can configure the dependency here, as a fragment/selectionSet
   *
   * Example: '{ id title }'
   */
  dependsOn?: RawNodeSelection<TSource>;
}

export type ThunkableNillableVirtualFieldOutputConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  utils.Nillable<
    VirtualFieldOutputConfig<TRequestContext, TConnector, TContainer>
  >,
  [node: Node<TRequestContext, TConnector, TContainer>]
>;

export type ThunkableNillableVirtualFieldOutputConfigsByName<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> = utils.Thunkable<
  utils.Nillable<{
    [fieldName: utils.Name]: ThunkableNillableVirtualFieldOutputConfig<
      TRequestContext,
      TConnector,
      TContainer
    >;
  }>,
  [node: Node<TRequestContext, TConnector, TContainer>]
>;

export class VirtualFieldOutputType {
  readonly #dependsOnConfig?: RawNodeSelection;
  readonly #dependsOnConfigPath: utils.Path;
  readonly #graphql: graphql.GraphQLFieldConfig<NodeSelectedValue, any>;

  public constructor(
    public readonly parent: NodeOutputType,
    public readonly name: utils.Name,
    { dependsOn, ...config }: VirtualFieldOutputConfig,
    public readonly configPath: utils.Path,
  ) {
    utils.assertName(name, configPath);

    // depends-on
    {
      this.#dependsOnConfig = dependsOn;
      this.#dependsOnConfigPath = utils.addPath(configPath, 'dependsOn');
    }

    this.#graphql = {
      ...config,
      ...(config.resolve && {
        resolve: config.resolve.bind(parent.node.gp),
      }),
      ...(config.subscribe && {
        subscribe: config.subscribe.bind(parent.node.gp),
      }),
    };
  }

  @Memoize()
  public get dependsOn(): NodeSelection | undefined {
    return this.#dependsOnConfig
      ? this.parent.select(
          this.#dependsOnConfig,
          undefined,
          undefined,
          this.#dependsOnConfigPath,
        )
      : undefined;
  }

  public isPublic(): boolean {
    return true;
  }

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    NodeSelectedValue,
    any
  > {
    return this.#graphql;
  }

  @Memoize()
  public validate(): void {
    this.dependsOn;
    this.isPublic();
    this.getGraphQLFieldConfig();
  }
}
