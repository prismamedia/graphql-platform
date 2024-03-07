import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { BrokerInterface } from '../broker-interface.js';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node } from '../node.js';
import {
  type ComponentConfig,
  type UniqueConstraintConfig,
} from './definition.js';
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
  name?: string;

  components?: Record<string, ComponentConfig<TConnector>>;

  uniques?: UniqueConstraintConfig<TConnector>[];

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
};

export class NodeFeature<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> {
  public readonly configPath: utils.Path;

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

    this.configPath =
      typeof config.name === 'string' && config.name
        ? utils.addPath(configPath, config.name)
        : configPath;
  }

  @Memoize((mutationType: utils.MutationType) => mutationType)
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
