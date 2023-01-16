import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import type { GPBoundGraphQLFieldConfig } from '../../../../../graphql.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../statement/selection.js';
import type { MaybeNodeAwareConfig } from '../../../maybe-node-aware-config.js';
import type { NodeOutputType, RawNodeSelection } from '../../node.js';

export interface VirtualFieldOutputTypeConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TSource extends NodeSelectedValue = any,
  TArgs = any,
  TResult = unknown,
> extends GPBoundGraphQLFieldConfig<
    TRequestContext,
    TConnector,
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

export type VirtualFieldOutputTypeConfigMap<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = MaybeNodeAwareConfig<
  TRequestContext,
  TConnector,
  Record<utils.Name, VirtualFieldOutputTypeConfig<TRequestContext, TConnector>>
>;

export class VirtualFieldOutputType {
  readonly #dependsOnConfig?: RawNodeSelection;
  readonly #dependsOnConfigPath: utils.Path;

  readonly #graphql: graphql.GraphQLFieldConfig<NodeSelectedValue, any>;

  public constructor(
    public readonly parent: NodeOutputType,
    public readonly name: utils.Name,
    { dependsOn, resolve, ...graphql }: VirtualFieldOutputTypeConfig<any, any>,
    public readonly configPath: utils.Path,
  ) {
    utils.assertName(name, configPath);

    // depends-on
    {
      this.#dependsOnConfig = dependsOn;
      this.#dependsOnConfigPath = utils.addPath(configPath, 'dependsOn');
    }

    this.#graphql = { ...graphql, resolve: resolve?.bind(parent.node.gp) };
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
