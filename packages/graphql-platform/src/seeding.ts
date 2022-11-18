import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
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
  public readonly dependencyGraph = new DepGraph<
    NodeFixture<TRequestContext, TConnector>
  >({ circular: false });

  /**
   * The fixtures are ordered by their dependencies
   */
  public readonly fixtures: ReadonlyArray<
    NodeFixture<TRequestContext, TConnector>
  >;

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,
    fixtures: NodeFixtureDataByReferenceByNodeName,
  ) {
    const fixturesPath = utils.addPath(undefined, 'fixtures');

    if (!utils.isPlainObject(fixtures)) {
      throw new utils.UnexpectedConfigError('a plain-object', fixtures, {
        path: fixturesPath,
      });
    }

    Object.entries(fixtures).forEach(([nodeName, dataByReference]) => {
      const node = gp.nodesByName.get(nodeName);
      if (!node) {
        throw new utils.UnexpectedConfigError(
          `an existing node's name`,
          nodeName,
          { path: fixturesPath },
        );
      }

      const dataByReferencePath = utils.addPath(fixturesPath, nodeName);

      if (!utils.isPlainObject(dataByReference)) {
        throw new utils.UnexpectedConfigError(
          'a plain-object',
          dataByReference,
          { path: dataByReferencePath },
        );
      }

      Object.entries(dataByReference).forEach(([reference, data]) =>
        this.dependencyGraph.addNode(
          reference,
          new NodeFixture(
            this,
            node,
            reference,
            data,
            utils.addPath(dataByReferencePath, reference),
          ),
        ),
      );
    });

    this.dependencyGraph
      .entryNodes()
      .forEach((reference) =>
        this.dependencyGraph
          .getNodeData(reference)
          .dependencies.forEach((dependency) =>
            this.dependencyGraph.addDependency(reference, dependency),
          ),
      );

    this.fixtures = this.dependencyGraph
      .overallOrder()
      .map((reference) => this.dependencyGraph.getNodeData(reference));
  }

  @Memoize((context: TRequestContext) => context)
  public async load(context: TRequestContext): Promise<void> {
    await Promise.all(this.fixtures.map((fixture) => fixture.load(context)));
  }
}
