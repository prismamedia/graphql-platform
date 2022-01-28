import {
  addPath,
  aggregateConfigError,
  aggregateError,
  ensureName,
  isPlainObject,
  UnexpectedConfigError,
  UnexpectedValueError,
  type Name,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
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
  name?: Name;
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
  public readonly name: Name;
  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TRequestContext, TConnector>
  >;
  public readonly leavesByName: ReadonlyMap<
    Leaf['name'],
    Leaf<TRequestContext, TConnector>
  >;
  public readonly edgesByName: ReadonlyMap<
    Edge['name'],
    Edge<TRequestContext, TConnector>
  >;
  public readonly componentSet: Set<Component<TRequestContext, TConnector>>;
  public readonly composite: boolean;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    config: UniqueConstraintConfig<TRequestContext, TConnector>,
    public readonly configPath: Path,
  ) {
    let componentsConfigPath: Path;
    if (isShortConfig(config)) {
      this.config = { components: config } as FullUniqueConstraintConfig<
        TRequestContext,
        TConnector
      >;
      componentsConfigPath = configPath;
    } else {
      this.config = config;
      componentsConfigPath = addPath(configPath, 'components');
    }

    // components
    {
      if (
        !Array.isArray(this.config.components) ||
        !this.config.components.length
      ) {
        throw new UnexpectedValueError(
          `at least one "component"`,
          this.config.components,
          { path: componentsConfigPath },
        );
      }

      this.componentsByName = new Map(
        aggregateConfigError<
          string,
          [Component['name'], Component<TRequestContext, TConnector>][]
        >(
          this.config.components.values(),
          (entries, componentName, index) => {
            const component = node.componentsByName.get(componentName);
            if (!component) {
              throw new UnexpectedConfigError(
                `a "component"'s name among "${[
                  ...node.componentsByName.keys(),
                ].join(', ')}"`,
                componentName,
                { path: addPath(componentsConfigPath, index) },
              );
            }

            return [...entries, [component.name, component]];
          },
          [],
          { path: componentsConfigPath },
        ),
      );

      this.leavesByName = new Map(
        Array.from(this.componentsByName).filter(
          (entry): entry is [string, Leaf] => entry[1] instanceof Leaf,
        ),
      );

      this.edgesByName = new Map(
        Array.from(this.componentsByName).filter(
          (entry): entry is [string, Edge] => entry[1] instanceof Edge,
        ),
      );

      this.componentSet = new Set(this.componentsByName.values());
    }

    // composite
    {
      this.composite = this.componentsByName.size > 1;
    }

    // name
    {
      const nameConfig = this.config.name;
      const nameConfigPath = addPath(configPath, 'name');

      this.name = nameConfig
        ? ensureName(nameConfig, nameConfigPath)
        : [...this.componentsByName.keys()].join('_');
    }
  }

  @Memoize()
  public toString(): string {
    return `${this.node.name}.${this.name}`;
  }

  @Memoize()
  public get referrers(): Set<Edge> {
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
  public get selection(): NodeSelection {
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
    this.referrers;
    this.isIdentifier();
    this.isMutable();
    this.isNullable();
    this.isPublic();
    this.selection;
  }

  public parseValue(
    maybeValue: unknown,
    path: Path = addPath(undefined, this.toString()),
  ): UniqueConstraintValue {
    if (!isPlainObject(maybeValue)) {
      throw new UnexpectedValueError('a plain-object', maybeValue, { path });
    }

    const value = aggregateError<Component, UniqueConstraintValue>(
      this.componentsByName.values(),
      (value, component) =>
        Object.assign(value, {
          [component.name]: component.parseValue(
            maybeValue[component.name],
            addPath(path, component.name),
          ),
        }),
      Object.create(null),
      { path },
    );

    if (
      Array.from(this.componentsByName.keys()).every(
        (componentName) => value[componentName] === null,
      )
    ) {
      throw new UnexpectedValueError(
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
    return Array.from(this.componentsByName.values()).every((component) =>
      component.areValuesEqual(
        a[component.name] as any,
        b[component.name] as any,
      ),
    );
  }
}
