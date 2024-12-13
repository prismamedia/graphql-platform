import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import assert from 'node:assert';
import type {
  ConnectorConfigOverride,
  ConnectorConfigOverrideKind,
  ConnectorInterface,
} from '../../connector-interface.js';
import type { Node, NodeFilter } from '../../node.js';
import {
  NodeSelection,
  mergeSelectionExpressions,
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

export class UniqueConstraint<TConnector extends ConnectorInterface = any> {
  public readonly config: FullUniqueConstraintConfig<TConnector>;
  public readonly name: utils.Name;

  public readonly componentsByName: ReadonlyMap<
    Component['name'],
    Component<TConnector>
  >;

  public readonly componentSet: ReadonlySet<Component<TConnector>>;
  public readonly leafSet: ReadonlySet<Leaf<TConnector>>;
  public readonly edgeSet: ReadonlySet<Edge<TConnector>>;

  public constructor(
    public readonly node: Node<any, TConnector>,
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
            const componentPath = utils.addPath(componentsConfigPath, index);

            const component = node.getComponentByName(
              componentName,
              componentPath,
            );

            if (component instanceof Leaf && !component.isComparable()) {
              throw new utils.GraphError(
                `The "${component}" leaf is not comparable, therefore it cannot be part of a unique-constraint`,
                { path: componentPath },
              );
            }

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
          this.componentSet
            .values()
            .filter(
              (component): component is Leaf => component instanceof Leaf,
            ),
        );
      }

      // edges
      {
        this.edgeSet = new Set(
          this.componentSet
            .values()
            .filter(
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
  public get referrerSet(): ReadonlySet<Edge<TConnector>> {
    return new Set(
      this.node.gp.nodesByName
        .values()
        .flatMap((node) =>
          node.edgesByName
            .values()
            .filter((edge) => edge.referencedUniqueConstraint === this),
        ),
    );
  }

  @Memoize()
  public isComposite(): boolean {
    return this.componentSet.size > 1;
  }

  @Memoize()
  public isPureLeaf(): boolean {
    return this.componentSet.size === 1 && this.leafSet.size === 1;
  }

  @Memoize()
  public getPureLeaf(): Leaf<TConnector> {
    assert(
      this.isPureLeaf(),
      `The "${this}" unique-constraint is not pure-leaf`,
    );

    return [...this.leafSet][0]!;
  }

  @Memoize()
  public isMutable(): boolean {
    return this.componentSet
      .values()
      .some((component) => component.isMutable());
  }

  @Memoize()
  public isNullable(): boolean {
    return this.componentSet
      .values()
      .every((component) => component.isNullable());
  }

  /**
   * Is an identifier if it's non-nullable and immutable
   */
  @Memoize()
  public isIdentifier(): boolean {
    return !this.isNullable() && !this.isMutable();
  }

  @Memoize()
  public isMainIdentifier(): boolean {
    return this.node.mainIdentifier === this;
  }

  @Memoize()
  public isPublic(): boolean {
    return this.componentSet
      .values()
      .every(
        (component) =>
          component.isPublic() &&
          (component instanceof Leaf ||
            component.referencedUniqueConstraint.isPublic()),
      );
  }

  @Memoize()
  public isScrollable(): boolean {
    if (!this.isPureLeaf()) {
      return false;
    }

    const leaf = this.getPureLeaf();

    return leaf.isSortable() && !leaf.isNullable();
  }

  @Memoize()
  public get selection(): NodeSelection<UniqueConstraintValue> {
    return new NodeSelection(
      this.node,
      mergeSelectionExpressions(
        Array.from(this.componentSet, ({ selection }) => selection),
      ),
    );
  }

  public validateDefinition(): void {
    this.referrerSet;
    this.isComposite();
    this.isMutable();
    this.isNullable();
    this.isIdentifier();
    this.isMainIdentifier();
    this.isPublic();
    this.isScrollable();
    this.selection;
  }

  @Memoize()
  public getGraphQLObjectType(): graphql.GraphQLObjectType {
    assert(this.isPublic(), `The "${this}" unique-constraint is private`);

    return new graphql.GraphQLObjectType({
      name: [
        this.node.name,
        ...Array.from(this.componentSet, ({ name }) =>
          inflection.camelize(name, false),
        ),
      ].join(''),
      fields: () =>
        this.componentSet
          .values()
          .reduce<
            graphql.GraphQLFieldConfigMap<any, any>
          >((fields, component) => {
            if (component.isPublic()) {
              const type =
                component instanceof Leaf
                  ? component.type
                  : component.referencedUniqueConstraint.isPublic()
                    ? component.referencedUniqueConstraint.getGraphQLObjectType()
                    : undefined;

              if (type) {
                fields[component.name] = {
                  ...(component.description && {
                    description: component.description,
                  }),
                  ...(component.deprecationReason && {
                    deprecationReason: component.deprecationReason,
                  }),
                  type: component.isNullable()
                    ? type
                    : new graphql.GraphQLNonNull(type),
                };
              }
            }

            return fields;
          }, {}),
    });
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.toString()),
  ): UniqueConstraintValue {
    utils.assertPlainObject(maybeValue, path);

    const value = Object.create(null);

    let hasNonNullComponentValue: boolean = false;

    for (const component of this.componentSet) {
      let componentValue: ComponentValue;

      const rawComponentValue = maybeValue[component.name];

      if (rawComponentValue === undefined) {
        throw new utils.UnexpectedUndefinedError(component.name, { path });
      } else if (rawComponentValue === null) {
        if (!component.isNullable()) {
          throw new utils.UnexpectedNullError(component.name, { path });
        }

        componentValue = null;
      } else {
        const componentPath = utils.addPath(path, component.name);

        componentValue =
          component instanceof Leaf
            ? component.parseValue(rawComponentValue, componentPath)
            : component.referencedUniqueConstraint.parseValue(
                rawComponentValue,
                componentPath,
              );
      }

      if (componentValue !== null) {
        hasNonNullComponentValue = true;
      }

      value[component.name] = componentValue;
    }

    if (!hasNonNullComponentValue) {
      throw new utils.UnexpectedValueError(
        `at least one non-null component's value`,
        maybeValue,
        { path },
      );
    }

    return value;
  }

  public createFilterFromValue(maybeValue: unknown): NodeFilter {
    return this.node.filterInputType.filter(this.parseValue(maybeValue));
  }

  public stringify(value: UniqueConstraintValue): string {
    return `{${Array.from(
      this.componentSet,
      (component) =>
        `"${component.name}":${
          value[component.name] === null
            ? 'null'
            : component instanceof Leaf
              ? component.stringify(value[component.name])
              : component.referencedUniqueConstraint.stringify(
                  value[component.name] as UniqueConstraintValue,
                )
        }`,
    ).join(',')}}`;
  }
}
