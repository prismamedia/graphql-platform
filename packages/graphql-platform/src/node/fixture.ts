import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, NodeValue } from '../node.js';
import type { Seeding } from '../seeding.js';
import type { UniqueConstraintValue } from './definition.js';
import { EdgeCreationInputAction } from './type/input/creation/field.js';

export type NodeFixtureReference = string;

export type NodeFixtureData = utils.PlainObject;

export class NodeFixture<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public constructor(
    public readonly seeding: Seeding<TRequestContext, TConnector>,
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly reference: NodeFixtureReference,
    public readonly data: NodeFixtureData,
    public readonly path: utils.Path,
  ) {
    if (!utils.isPlainObject(data)) {
      throw new utils.UnexpectedConfigError('a plain-object', data, { path });
    }
  }

  @Memoize()
  public get dependencies(): ReadonlySet<NodeFixtureReference> {
    return new Set(
      this.node.edges.reduce<NodeFixtureReference[]>((dependencies, edge) => {
        const maybeEdgeReference = this.data[edge.name];
        if (maybeEdgeReference != null) {
          if (typeof maybeEdgeReference !== 'string') {
            throw new utils.UnexpectedConfigError(
              'a string',
              maybeEdgeReference,
              { path: utils.addPath(this.path, edge.name) },
            );
          } else if (
            !this.seeding.dependencyGraph.hasNode(maybeEdgeReference)
          ) {
            throw new utils.UnexpectedConfigError(
              "an existing fixture's reference",
              maybeEdgeReference,
              { path: utils.addPath(this.path, edge.name) },
            );
          }

          dependencies.push(maybeEdgeReference);
        }

        return dependencies;
      }, []),
    );
  }

  @Memoize()
  public get dependents(): ReadonlySet<NodeFixtureReference> {
    return new Set(
      Array.from(this.seeding.fixtures.values()).reduce<NodeFixtureReference[]>(
        (dependents, fixture) => {
          if (fixture.dependencies.has(this.reference)) {
            dependents.push(fixture.reference);
          }

          return dependents;
        },
        [],
      ),
    );
  }

  @Memoize((context: TRequestContext) => context)
  public async load(context: TRequestContext): Promise<NodeValue> {
    const data = this.node.creationInputType.parseValue(
      Object.fromEntries(
        await Promise.all(
          Object.entries(this.data).map(
            async ([componentName, componentValue]) => [
              componentName,
              this.node.edgesByName.has(componentName)
                ? {
                    [EdgeCreationInputAction.CONNECT]:
                      await this.seeding.dependencyGraph
                        .getNodeData(componentValue)
                        .getIdentifier(context),
                  }
                : componentValue,
            ],
          ),
        ),
      ),
      this.path,
    ) as any;

    return this.node
      .getMutationByKey('create-one')
      .execute(
        { data, selection: this.node.selection },
        context,
        this.path,
      ) as any;
  }

  @Memoize((context: TRequestContext) => context)
  public async getIdentifier(
    context: TRequestContext,
  ): Promise<UniqueConstraintValue> {
    const nodeValue = await this.load(context);

    return this.node.identifier.parseValue(nodeValue);
  }
}
