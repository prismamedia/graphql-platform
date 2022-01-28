import {
  addPath,
  assertName,
  castToError,
  UnexpectedConfigError,
  type Name,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../../connector-interface.js';
import {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../statement/selection.js';
import { MaybeNodeAwareConfig } from '../../../maybe-node-aware-config.js';
import { NodeOutputType, RawNodeSelection } from '../../node.js';

export interface VirtualFieldOutputTypeConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends graphql.GraphQLFieldConfig<NodeSelectedValue, TRequestContext, any> {
  /**
   * Optional, in order to compute this virtual field value, you certainly need some other fields' value in the resolver's source,
   * you can configure the dependency here, as a fragment/selectionSet
   *
   * Example: '{ id title }'
   */
  dependsOn?: RawNodeSelection;
}

export type VirtualFieldOutputTypeConfigMap<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = MaybeNodeAwareConfig<
  TRequestContext,
  TConnector,
  Record<Name, VirtualFieldOutputTypeConfig<TRequestContext, TConnector>>
>;

export class VirtualFieldOutputType {
  readonly #dependsOnConfig?: RawNodeSelection;
  readonly #dependsOnConfigPath: Path;

  public readonly graphql: graphql.GraphQLFieldConfig<
    NodeSelectedValue,
    any,
    any
  >;

  public constructor(
    public readonly parent: NodeOutputType,
    public readonly name: Name,
    { dependsOn, ...graphql }: VirtualFieldOutputTypeConfig<any, any>,
    public readonly configPath: Path,
  ) {
    assertName(name, configPath);

    this.graphql = graphql;

    // dependsOn
    {
      this.#dependsOnConfig = dependsOn;
      this.#dependsOnConfigPath = addPath(configPath, 'dependsOn');
    }
  }

  @Memoize()
  public get dependsOn(): NodeSelection | undefined {
    if (this.#dependsOnConfig) {
      try {
        return this.parent.select(this.#dependsOnConfig);
      } catch (error) {
        throw new UnexpectedConfigError(
          `a valid fragment`,
          this.#dependsOnConfig,
          {
            path: this.#dependsOnConfigPath,
            cause: castToError(error),
          },
        );
      }
    }

    return undefined;
  }

  public isPublic(): boolean {
    return true;
  }

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    NodeSelectedValue,
    any,
    any
  > {
    return this.graphql;
  }

  @Memoize()
  public validate(): void {
    this.dependsOn;
    this.getGraphQLFieldConfig();
  }
}
