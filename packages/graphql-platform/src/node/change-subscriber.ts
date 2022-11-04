import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import { Node } from '../node.js';
import type { NodeChange } from './change.js';

export interface NodeChangeSubscriberConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  name: utils.Name;

  /**
   * Either this subscriber processes the "changes":
   * - "BEFORE" the mutation's response is returned to the client (= false)
   * - "AFTER" the mutation's response is returned to the client - in another process through a distributed pub/sub service (= true)
   *
   * Default: false
   */
  distributed?: utils.OptionalFlag;

  /**
   * Optional, keep only the changes of these nodes
   */
  nodes?: utils.ArrayOrValue<Node['name'] | Node>;

  /**
   * Optional, keep only the changes of these kinds
   */
  kinds?: utils.ArrayOrValue<NodeChange['kind']>;

  /**
   * Either this subscriber is interested in this "change" or not?
   */
  filter?: (
    this: GraphQLPlatform<TRequestContext, TConnector>,
    change: NodeChange<TRequestContext, TConnector>,
  ) => boolean;

  /**
   * The function called for every "change" the subscription receives
   */
  next: (
    this: GraphQLPlatform<TRequestContext, TConnector>,
    change: NodeChange<TRequestContext, TConnector>,
  ) => Promisable<void>;
}

export class NodeChangeSubscriber {
  public readonly name: utils.Name;

  public readonly nodeSet?: ReadonlySet<Node>;

  public readonly kindSet?: ReadonlySet<utils.MutationType>;

  readonly #filter?: (change: NodeChange) => boolean;

  public readonly next: (change: NodeChange) => Promisable<void>;

  public constructor(
    public readonly gp: GraphQLPlatform,
    protected readonly config: NodeChangeSubscriberConfig,
    protected readonly configPath: utils.Path,
  ) {
    utils.assertPlainObjectConfig(config, configPath);

    // name
    {
      this.name = utils.ensureName(
        config.name,
        utils.addPath(configPath, 'name'),
      );
    }

    // node-set
    {
      const nodesConfig = config.nodes;
      const nodesConfigPath = utils.addPath(configPath, 'nodes');

      if (nodesConfig != null) {
        const nodes = utils
          .resolveArrayOrValue(nodesConfig)
          .map((nodeOrName, index) => {
            const node =
              nodeOrName instanceof Node
                ? nodeOrName
                : gp.nodesByName.get(nodeOrName);

            if (!node) {
              throw new utils.UnexpectedConfigError(
                `an existing node's name`,
                nodeOrName,
                { path: utils.addPath(nodesConfigPath, index) },
              );
            }

            return node;
          });

        if (nodes.length) {
          this.nodeSet = new Set(nodes);
        }
      }
    }

    // kind-set
    {
      const kindsConfig = config.kinds;
      const kindsConfigPath = utils.addPath(configPath, 'kinds');

      if (kindsConfig != null) {
        const kinds = utils
          .resolveArrayOrValue(kindsConfig)
          .map((kind, index) => {
            if (!utils.mutationTypes.includes(kind)) {
              throw new utils.UnexpectedConfigError(`a mutation-type`, kind, {
                path: utils.addPath(kindsConfigPath, index),
              });
            }

            return kind;
          });

        if (kinds.length) {
          this.kindSet = new Set(kinds);
        }
      }
    }

    // filter
    {
      const filterConfig = config.filter;
      const filterConfigPath = utils.addPath(configPath, 'filter');

      if (filterConfig != null) {
        if (typeof filterConfig !== 'function') {
          throw new utils.UnexpectedConfigError(`a function`, filterConfig, {
            path: filterConfigPath,
          });
        }

        this.#filter = filterConfig.bind(gp);
      }
    }

    // next
    {
      const nextConfig = config.next;
      const nextConfigPath = utils.addPath(configPath, 'next');

      if (typeof nextConfig !== 'function') {
        throw new utils.UnexpectedConfigError(`a function`, nextConfig, {
          path: nextConfigPath,
        });
      }

      this.next = nextConfig.bind(gp);
    }
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isDistributed(): boolean {
    return utils.getOptionalFlag(
      this.config.distributed,
      false,
      utils.addPath(this.configPath, 'distributed'),
    );
  }

  public filter(change: NodeChange): boolean {
    return (
      (this.nodeSet ? this.nodeSet.has(change.node) : true) &&
      (this.kindSet ? this.kindSet.has(change.kind) : true) &&
      (this.#filter ? this.#filter(change) : true)
    );
  }
}
