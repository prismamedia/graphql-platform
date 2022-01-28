import {
  isPlainObject,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import type { ConnectorInterface } from './connector-interface.js';
import type { GraphQLPlatform } from './index.js';
import {
  Node,
  NodeFixture,
  NodeFixtureData,
  NodeFixtureReference,
} from './node.js';

export type NodeFixtureDataByReference = Record<
  NodeFixtureReference,
  NodeFixtureData
>;

export type NodeFixtureDataByReferenceByNodeName = Record<
  Node['name'],
  NodeFixtureDataByReference
>;

export class Seeding<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  /**
   * The fixtures are ordered by their dependencies
   */
  public readonly fixturesByReference: Map<
    NodeFixtureReference,
    NodeFixture<TRequestContext, TConnector>
  >;

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,
    fixtures: NodeFixtureDataByReferenceByNodeName,
  ) {
    if (!isPlainObject(fixtures)) {
      throw new UnexpectedValueError('a plain-object', fixtures);
    }

    const depGraph = new DepGraph<NodeFixture<TRequestContext, TConnector>>({
      circular: false,
    });

    Object.entries(fixtures).forEach(([nodeName, dataByReference]) =>
      Object.entries(dataByReference).forEach(([reference, data]) =>
        depGraph.addNode(
          reference,
          new NodeFixture(this, gp.getNode(nodeName), reference, data),
        ),
      ),
    );

    Object.values(fixtures).forEach((dataByReference) =>
      Object.keys(dataByReference).forEach((reference) =>
        depGraph
          .getNodeData(reference)
          .dependencies.forEach((dependency) =>
            depGraph.addDependency(reference, dependency),
          ),
      ),
    );

    this.fixturesByReference = new Map(
      depGraph
        .overallOrder()
        .map((reference) => [reference, depGraph.getNodeData(reference)]),
    );
  }

  public async load(context: TRequestContext): Promise<void> {
    await Promise.all(
      Array.from(this.fixturesByReference.values(), (fixture) =>
        fixture.load(context),
      ),
    );
  }
}
