import * as utils from '@prismamedia/graphql-platform-utils';
import { MMethod } from '@prismamedia/memoize';
import type { BrokerInterface } from '../broker-interface.js';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../connector-interface.js';
import type { Node, NodeConfig } from '../node.js';
import type {
  CustomOperationConstructor,
  MutationConfig,
} from './operation.js';
import type { NodeOutputTypeConfig } from './type.js';

export type NodeFeatureConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> = {
  /**
   * Optional, identifies the feature in case of errors
   */
  name?: utils.Name;

  /**
   * Optional, define the priority of this feature, against the others features and the main configuration (having the priority 0)
   * An higher priority will be executed first
   *
   * Default: 0
   */
  priority?: number;
} & Pick<
  NodeConfig<TRequestContext, TConnector, TBroker, TContainer>,
  'components' | 'uniques' | 'associatedNodes' | 'reverseEdges'
> & {
    output?: Pick<
      NodeOutputTypeConfig<TRequestContext, TConnector, TBroker, TContainer>,
      'virtualFields'
    >;

    query?: {
      customs?: CustomOperationConstructor<
        TRequestContext,
        TConnector,
        TBroker,
        TContainer
      >[];
    };

    mutation?: {
      [TType in keyof MutationConfig]?: MutationConfig<
        TRequestContext,
        TConnector,
        TBroker,
        TContainer
      >[TType];
    } & {
      customs?: CustomOperationConstructor<
        TRequestContext,
        TConnector,
        TBroker,
        TContainer
      >[];
    };
  } & ConnectorConfigOverride<TConnector, ConnectorConfigOverrideKind.FEATURE>;

export class NodeFeature<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> {
  public readonly name?: utils.Name;

  public readonly configPath: utils.Path;

  public readonly priority: number;

  public constructor(
    public readonly node: Node,
    public readonly config: NodeFeatureConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,
    configPath: utils.Path,
  ) {
    utils.assertPlainObject(config, configPath);

    this.name = config.name
      ? utils.ensureName(config.name, utils.addPath(configPath, 'name'))
      : undefined;

    this.configPath = this.name
      ? utils.addPath(configPath, this.name)
      : configPath;

    this.priority = config.priority ?? node.priority;
  }

  @MMethod()
  public toString(): string {
    return [this.node.name, 'feature', this.name].filter(Boolean).join('.');
  }

  @MMethod((mutationType) => mutationType)
  public getMutationConfig<TType extends utils.MutationType>(
    mutationType: TType,
  ): {
    config?: MutationConfig<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >[TType];
    configPath: utils.Path;
  } {
    const mutationsConfig = this.config.mutation;
    const mutationsConfigPath = utils.addPath(this.configPath, 'mutation');

    utils.assertNillablePlainObject(mutationsConfig, mutationsConfigPath);

    if (!mutationsConfig) {
      return { configPath: mutationsConfigPath };
    }

    const mutationConfig = mutationsConfig?.[mutationType];
    const mutationConfigPath = utils.addPath(mutationsConfigPath, mutationType);

    utils.assertNillablePlainObject(mutationConfig, mutationConfigPath);

    return { config: mutationConfig, configPath: mutationConfigPath };
  }
}
