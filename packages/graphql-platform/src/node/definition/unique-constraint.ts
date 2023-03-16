import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { JsonObject } from 'type-fest';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
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

type FullUniqueConstraintConfig<TConnector extends ConnectorInterface = any> = {
  components: Component['name'][];
  name?: utils.Name;
} & ConnectorConfigOverride<
  TConnector,
  ConnectorConfigOverrideKind.UNIQUE_CONSTRAINT
>;

type ShortUniqueConstraintConfig = Component['name'][];

export type UniqueConstraintConfig<
  TConnector extends ConnectorInterface = any,
> = FullUniqueConstraintConfig<TConnector> | ShortUniqueConstraintConfig;

const isShortConfig = (
  config: UniqueConstraintConfig,
): config is ShortUniqueConstraintConfig => Array.isArray(config);

export class UniqueConstraint<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> {
  public readonly config: FullUniqueConstraintConfig<TConnector>;
  public readonly name: utils.Name;

  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector, TContainer>
  >;

  public readonly componentSet: ReadonlySet<
    Component<TRequestContext, TConnector, TContainer>
  >;

  public readonly leafSet: ReadonlySet<
    Leaf<TRequestContext, TConnector, TContainer>
  >;

  public readonly edgeSet: ReadonlySet<
    Edge<TRequestContext, TConnector, TContainer>
  >;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector, TContainer>,
    config: UniqueConstraintConfig<TConnector>,
    public readonly configPath: utils.Path,
  ) {
    let componentsConfigPath: utils.Path;
    if (isShortConfig(config)) {
      this.config = { components: config };
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
          `at least one component`,
          this.config.components,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        utils.aggregateGraphError<string, [Component['name'], Component][]>(
          this.config.components.values(),
          (entries, componentName, index) => {
            const component = node.getComponentByName(
              componentName,
              utils.addPath(componentsConfigPath, index),
            );

            return [...entries, [component.name, component]];
          },
          [],
          { path: componentsConfigPath },
        ),
      );

      this.componentSet = new Set(this.componentsByName.values());

      // leaves
      {
        this.leafSet = new Set(
          Array.from(this.componentsByName.values()).filter(
            (component): component is Leaf => component instanceof Leaf,
          ),
        );
      }

      // edges
      {
        this.edgeSet = new Set(
          Array.from(this.componentsByName.values()).filter(
            (component): component is Edge => component instanceof Edge,
          ),
        );
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
  public get referrerSet(): ReadonlySet<
    Edge<TRequestContext, TConnector, TContainer>
  > {
    return new Set(
      Array.from(this.node.gp.nodesByName.values()).flatMap((node) =>
        Array.from(node.edgesByName.values()).filter(
          (edge) => edge.referencedUniqueConstraint === this,
        ),
      ),
    );
  }

  @Memoize()
  public isIdentifier(): boolean {
    return this.node.identifier === this;
  }

  @Memoize()
  public isComposite(): boolean {
    return this.componentsByName.size > 1;
  }

  @Memoize()
  public isMutable(): boolean {
    return Array.from(this.componentsByName.values()).some((component) =>
      component.isMutable(),
    );
  }

  @Memoize()
  public isNullable(): boolean {
    return Array.from(this.componentsByName.values()).every((component) =>
      component.isNullable(),
    );
  }

  @Memoize()
  public isPublic(): boolean {
    return Array.from(this.componentsByName.values()).every((component) =>
      component.isPublic(),
    );
  }

  @Memoize()
  public isScrollable(): boolean {
    return (
      this.componentsByName.size === 1 &&
      Array.from(this.componentsByName.values()).every(
        (component) => component instanceof Leaf && component.isSortable(),
      )
    );
  }

  @Memoize()
  public get selection(): NodeSelection<UniqueConstraintValue> {
    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        Array.from(
          this.componentsByName.values(),
          ({ selection }) => selection,
        ),
      ),
    );
  }

  public validateDefinition(): void {
    this.referrerSet;
    this.isIdentifier();
    this.isComposite();
    this.isMutable();
    this.isNullable();
    this.isPublic();
    this.isScrollable();
    this.selection;
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): UniqueConstraintValue {
    const value = this.selection.parseValue(maybeValue, path);

    if (
      this.isNullable() &&
      Array.from(this.componentsByName.values()).every(
        ({ name }) => value[name] === null,
      )
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
