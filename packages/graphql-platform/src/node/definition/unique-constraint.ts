import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { JsonObject } from 'type-fest';
import type {
  ConnectorConfigOverrideKind,
  ConnectorInterface,
  GetConnectorConfigOverride,
} from '../../connector-interface.js';
import type { Node } from '../../node.js';
import {
  mergeSelectionExpressions,
  NodeSelection,
} from '../statement/selection.js';
import type { Component, ComponentValue } from './component.js';
import { Edge } from './component/edge.js';
import { Leaf } from './component/leaf.js';

export type UniqueConstraintValue = {
  [componentName: string]: ComponentValue;
};

type FullUniqueConstraintConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = {
  components: Component['name'][];
  name?: utils.Name;
} & GetConnectorConfigOverride<
  TConnector,
  ConnectorConfigOverrideKind.UNIQUE_CONSTRAINT
>;

type ShortUniqueConstraintConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = Component['name'][];

export type UniqueConstraintConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> =
  | FullUniqueConstraintConfig<TRequestContext, TConnector>
  | ShortUniqueConstraintConfig<TRequestContext, TConnector>;

const isShortConfig = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  config: UniqueConstraintConfig<TRequestContext, TConnector>,
): config is ShortUniqueConstraintConfig<TRequestContext, TConnector> =>
  Array.isArray(config);

export class UniqueConstraint<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  public readonly config: FullUniqueConstraintConfig<
    TRequestContext,
    TConnector
  >;
  public readonly name: utils.Name;

  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector>
  >;
  public readonly components: ReadonlyArray<
    Component<TRequestContext, TConnector>
  >;
  public readonly componentSet: ReadonlySet<
    Component<TRequestContext, TConnector>
  >;

  public readonly leavesByName: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector>
  >;
  public readonly leaves: ReadonlyArray<Leaf<TRequestContext, TConnector>>;
  public readonly leafSet: ReadonlySet<Leaf<TRequestContext, TConnector>>;

  public readonly edgesByName: ReadonlyMap<
    Edge['name'],
    Edge<TRequestContext, TConnector>
  >;
  public readonly edges: ReadonlyArray<Edge<TRequestContext, TConnector>>;
  public readonly edgeSet: ReadonlySet<Edge<TRequestContext, TConnector>>;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    config: UniqueConstraintConfig<TRequestContext, TConnector>,
    public readonly configPath: utils.Path,
  ) {
    let componentsConfigPath: utils.Path;
    if (isShortConfig(config)) {
      this.config = { components: config } as FullUniqueConstraintConfig<
        TRequestContext,
        TConnector
      >;
      componentsConfigPath = configPath;
    } else {
      this.config = config;
      componentsConfigPath = utils.addPath(configPath, 'components');
    }

    // components
    {
      if (
        !Array.isArray(this.config.components) ||
        !this.config.components.length
      ) {
        throw new utils.UnexpectedValueError(
          `at least one "component"`,
          this.config.components,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        utils.aggregateGraphError<
          string,
          [Component['name'], Component<TRequestContext, TConnector>][]
        >(
          this.config.components.values(),
          (entries, componentName, index) => {
            const component = node.componentsByName.get(componentName);
            if (!component) {
              throw new utils.UnexpectedValueError(
                `a "component"'s name among "${[
                  ...node.componentsByName.keys(),
                ].join(', ')}"`,
                componentName,
                { path: utils.addPath(componentsConfigPath, index) },
              );
            }

            return [...entries, [component.name, component]];
          },
          [],
          { path: componentsConfigPath },
        ),
      );

      this.components = Array.from(this.componentsByName.values());
      this.componentSet = new Set(this.components);

      // leaves
      {
        this.leavesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Leaf] => entry[1] instanceof Leaf,
          ),
        );

        this.leaves = Array.from(this.leavesByName.values());
        this.leafSet = new Set(this.leaves);
      }

      // edges
      {
        this.edgesByName = new Map(
          Array.from(this.componentsByName).filter(
            (entry): entry is [string, Edge] => entry[1] instanceof Edge,
          ),
        );

        this.edges = Array.from(this.edgesByName.values());
        this.edgeSet = new Set(this.edges);
      }
    }

    // name
    {
      const nameConfig = this.config.name;
      const nameConfigPath = utils.addPath(configPath, 'name');

      this.name = nameConfig
        ? utils.ensureName(nameConfig, nameConfigPath)
        : Array.from(this.componentsByName.keys()).join('-');
    }
  }

  @Memoize()
  public toString(): string {
    return `${this.node.name}#${this.name}`;
  }

  @Memoize()
  public get referrers(): Set<Edge> {
    return new Set(
      this.node.gp.nodes.flatMap((node) =>
        node.edges.filter((edge) => edge.referencedUniqueConstraint === this),
      ),
    );
  }

  @Memoize()
  public isIdentifier(): boolean {
    return this.node.identifier === this;
  }

  @Memoize()
  public isComposite(): boolean {
    return this.components.length > 1;
  }

  @Memoize()
  public isMutable(): boolean {
    return this.components.some((component) => component.isMutable());
  }

  @Memoize()
  public isNullable(): boolean {
    return this.components.every((component) => component.isNullable());
  }

  @Memoize()
  public isPublic(): boolean {
    return this.components.every((component) => component.isPublic());
  }

  @Memoize()
  public isSortable(): boolean {
    return (
      this.components.length === 1 &&
      this.components.every(
        (component) => component instanceof Leaf && component.isSortable(),
      )
    );
  }

  @Memoize()
  public get selection(): NodeSelection<UniqueConstraintValue> {
    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        this.components.map(({ selection }) => selection),
      ),
    );
  }

  public validateDefinition(): void {
    this.referrers;
    this.isIdentifier();
    this.isComposite();
    this.isMutable();
    this.isNullable();
    this.isPublic();
    this.isSortable();
    this.selection;
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): UniqueConstraintValue {
    const value = this.selection.parseValue(maybeValue, path);

    if (
      this.isNullable() &&
      this.components.every(({ name }) => value[name] === null)
    ) {
      throw new utils.UnexpectedValueError(
        `at least one non-null component's value`,
        maybeValue,
        { path },
      );
    }

    return value;
  }

  public areValuesEqual(
    a: UniqueConstraintValue,
    b: UniqueConstraintValue,
  ): boolean {
    return this.selection.areValuesEqual(a, b);
  }

  public serialize(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): JsonObject {
    return this.selection.serialize(maybeValue, path);
  }

  public stringify(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): string {
    return this.selection.stringify(maybeValue, path);
  }
}
