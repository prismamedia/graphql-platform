import {
  AbstractField,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLFieldConfig } from 'graphql';
import { IConnector } from '../../connector';
import { INodeValue, Node } from '../../node';
import { TFieldSelection } from '../fields';
import { parseFragmentSelections, TFragment } from '../selection';
import { IFieldSelection } from './abstract';

export interface ICustomSelection extends IFieldSelection<'Custom'> {}

export type TMaybeNodeAware<TContext, TConnector extends IConnector, T> =
  | T
  | ((node: Node<TContext, TConnector>) => T);

export const getMaybeNodeAware = <TContext, TConnector extends IConnector, T>(
  node: Node<TContext, TConnector>,
  config?: TMaybeNodeAware<TContext, TConnector, T>,
): T | undefined =>
  config
    ? ((typeof config === 'function' ? (config as any)(node) : config) as T)
    : undefined;

export interface ICustomFieldConfig<TContext = any>
  extends GraphQLFieldConfig<INodeValue, TContext, any> {
  /**
   * Optional, in order to compute this custom field value, you certainly need some other fields' value in the resolver's source,
   * you can configure the dependency here, as a fragment/selectionSet
   * Example: { id title }
   */
  fragment?: TFragment;
}

export type TCustomFieldConfigMap<
  TContext,
  TConnector extends IConnector
> = TMaybeNodeAware<
  TContext,
  TConnector,
  {
    [fieldName: string]: TMaybeNodeAware<
      TContext,
      TConnector,
      ICustomFieldConfig<TContext>
    >;
  }
>;

export function getCustomFieldConfigMap<
  TContext,
  TConnector extends IConnector
>(
  node: Node<TContext, TConnector>,
  config?: TCustomFieldConfigMap<TContext, TConnector>,
): Record<string, ICustomFieldConfig<TContext>> {
  const customFieldConfigMap: Record<string, ICustomFieldConfig<TContext>> = {};

  const customFieldConfigs = getMaybeNodeAware(node, config);
  if (customFieldConfigs) {
    for (const [fieldName, maybeCustomFieldConfig] of Object.entries(
      customFieldConfigs,
    )) {
      const customFieldConfig = getMaybeNodeAware(node, maybeCustomFieldConfig);

      if (customFieldConfig) {
        customFieldConfigMap[fieldName] = customFieldConfig;
      }
    }
  }

  return customFieldConfigMap;
}

export class CustomField extends AbstractField {
  readonly #fragment?: TFragment;
  readonly #selection: ICustomSelection = Object.freeze({
    kind: 'Custom',
    name: this.name,
  });
  readonly graphqlFieldConfig: GraphQLFieldConfig<INodeValue, any, any>;

  public constructor(
    public readonly node: Node,
    name: string,
    { fragment, ...config }: ICustomFieldConfig,
  ) {
    super(node, name, {
      description: config.description || undefined,
      public: true,
    });

    this.#fragment = fragment;
    this.graphqlFieldConfig = config;
  }

  @Memoize()
  public get dependsOn(): ReadonlyArray<TFieldSelection> | undefined {
    return this.#fragment
      ? parseFragmentSelections(this.node, this.#fragment)
      : undefined;
  }

  public parseFieldNode(): ICustomSelection {
    return this.#selection;
  }

  public assertValue(
    value: unknown,
    selection: IFieldSelection,
    path: Path,
  ): void {
    if (value !== undefined) {
      throw new UnexpectedValueError(value, `no value`, path);
    }
  }
}
