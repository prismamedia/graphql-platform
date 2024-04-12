import * as utils from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import type { GraphQLPlatform } from './index.js';
import type { MutationContext, Node } from './node.js';
import {
  NodeFixture,
  type NodeFixtureData,
  type NodeFixtureReference,
} from './node/fixture.js';

export type NodeFixtureDataByReference = Record<
  NodeFixtureReference,
  NodeFixtureData
>;

export type NodeFixtureDataByReferenceByNodeName = Record<
  Node['name'],
  NodeFixtureDataByReference
>;

export class Seeding<TRequestContext extends object = any> {
  public readonly dependencyGraph: DepGraph<NodeFixture<TRequestContext>>;

  /**
   * The fixtures are ordered by their dependencies
   */
  public readonly fixtures: ReadonlyArray<NodeFixture<TRequestContext>>;

  public constructor(
    public readonly gp: GraphQLPlatform<TRequestContext>,
    fixtures: NodeFixtureDataByReferenceByNodeName,
  ) {
    const fixturesPath = utils.addPath(undefined, 'fixtures');

    utils.assertPlainObject(fixtures, fixturesPath);

    this.dependencyGraph = new DepGraph({ circular: false });

    Object.entries(fixtures).forEach(([nodeName, dataByReference]) => {
      const node = gp.getNodeByName(nodeName, fixturesPath);

      const dataByReferencePath = utils.addPath(fixturesPath, nodeName);

      utils.assertPlainObject(dataByReference, dataByReferencePath);

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

  public async load(
    context: TRequestContext | MutationContext<TRequestContext>,
  ): Promise<void> {
    await Promise.all(this.fixtures.map((fixture) => fixture.load(context)));
  }
}
