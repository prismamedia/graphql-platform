import { Memoize } from '@prismamedia/ts-memoize';
import { assertValidName, GraphQLFieldConfig } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { Model } from '../../../../model';
import { NodeType } from '../../node';
import { FieldSelection } from '../fields';
import { Fragment } from '../selection';
import { NodeValue } from '../values';

export type MaybeModelAware<
  TRequestContext,
  TConnector extends ConnectorInterface,
  T,
> = T | ((model: Model<TRequestContext, TConnector>) => T);

export const resolveMaybeModelAware = <
  TRequestContext,
  TConnector extends ConnectorInterface,
  T,
>(
  model: Model<TRequestContext, TConnector>,
  config: MaybeModelAware<TRequestContext, TConnector, T>,
): T => (typeof config === 'function' ? (config as any)(model) : config);

export interface VirtualFieldConfig<TRequestContext = any>
  extends GraphQLFieldConfig<NodeValue, TRequestContext, any> {
  name: string;

  /**
   * Optional, in order to compute this virtual field value, you certainly need some other fields' value in the resolver's source,
   * you can configure the dependency here, as a fragment/selectionSet
   *
   * Example: '{ id title }'
   */
  dependsOn?: Fragment;
}

export type VirtualFieldConfigMap<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = MaybeModelAware<
  TRequestContext,
  TConnector,
  { [fieldName: string]: Omit<VirtualFieldConfig<TRequestContext>, 'name'> }
>;

export function getVirtualFieldConfigs<
  TRequestContext,
  TConnector extends ConnectorInterface,
>(
  model: Model<TRequestContext, TConnector>,
  config: VirtualFieldConfigMap<TRequestContext, TConnector>,
): VirtualFieldConfig<TRequestContext>[] {
  const virtualFieldConfigs: VirtualFieldConfig[] = [];

  for (const [name, virtualFieldConfig] of Object.entries(
    resolveMaybeModelAware(model, config),
  )) {
    virtualFieldConfigs.push({ name, ...virtualFieldConfig });
  }

  return virtualFieldConfigs;
}

export class VirtualField {
  public readonly name: string;
  public readonly public: boolean = true;
  public readonly graphqlFieldConfig: GraphQLFieldConfig<NodeValue, any, any>;
  readonly #dependsOn?: Fragment;

  public constructor(
    public readonly node: NodeType,
    { name, dependsOn, ...graphqlFieldConfig }: VirtualFieldConfig,
  ) {
    this.name = assertValidName(name);
    this.graphqlFieldConfig = graphqlFieldConfig;
    this.#dependsOn = dependsOn;
  }

  @Memoize()
  public get dependsOn(): ReadonlyArray<FieldSelection> {
    return Object.freeze(
      this.#dependsOn ? this.node.select(this.#dependsOn).fields : [],
    );
  }
}
