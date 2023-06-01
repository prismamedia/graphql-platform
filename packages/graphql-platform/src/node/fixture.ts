import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { DepGraph } from 'dependency-graph';
import type {
  Node,
  NodeCreationInputValue,
  NodeValue,
  UniqueConstraintValue,
} from '../node.js';
import type { Seeding } from '../seeding.js';
import {
  EdgeCreationInput,
  EdgeCreationInputAction,
  LeafCreationInput,
  MultipleReverseEdgeCreationInput,
  MultipleReverseEdgeCreationInputAction,
  UniqueReverseEdgeCreationInput,
  UniqueReverseEdgeCreationInputAction,
  type FieldCreationInput,
} from './type/input/creation/field.js';

export type NodeFixtureReference = string;

export type NodeFixtureData = utils.PlainObject;

function extractDependencies(
  dependencyGraph: DepGraph<NodeFixture>,
  node: Node,
  data: NodeFixtureData,
  path: utils.Path,
  dependencies: Set<NodeFixtureReference> = new Set(),
): Set<NodeFixtureReference> {
  utils.assertPlainObject(data, path);

  Object.entries(data).forEach(([fieldName, fieldValue]) => {
    const field = node.creationInputType.getFieldByName(fieldName, path);
    const fieldPath = utils.addPath(path, field.name);

    if (field instanceof EdgeCreationInput) {
      if (fieldValue != null) {
        if (typeof fieldValue !== 'string') {
          throw new utils.UnexpectedValueError('a string', fieldValue, {
            path: fieldPath,
          });
        } else if (!dependencyGraph.hasNode(fieldValue)) {
          throw new utils.UnexpectedValueError(
            "an existing fixture's reference",
            fieldValue,
            { path: fieldPath },
          );
        }

        dependencies.add(fieldValue);
      }
    } else if (field instanceof UniqueReverseEdgeCreationInput) {
      if (fieldValue != null) {
        extractDependencies(
          dependencyGraph,
          field.reverseEdge.head,
          fieldValue,
          fieldPath,
          dependencies,
        );
      }
    } else if (field instanceof MultipleReverseEdgeCreationInput) {
      if (fieldValue != null) {
        utils
          .resolveArrayable(fieldValue)
          .forEach((data, index) =>
            extractDependencies(
              dependencyGraph,
              field.reverseEdge.head,
              data,
              utils.addPath(fieldPath, index),
              dependencies,
            ),
          );
      }
    }
  });

  return dependencies;
}

async function extractData<TRequestContext extends object>(
  dependencyGraph: DepGraph<NodeFixture>,
  node: Node,
  data: NodeFixtureData,
  context: TRequestContext,
  path: utils.Path,
): Promise<NonNullable<NodeCreationInputValue>> {
  utils.assertPlainObject(data, path);

  return Object.fromEntries(
    await Promise.all(
      Object.entries(data).map(async ([fieldName, fieldValue]) => {
        const field = node.creationInputType.getFieldByName(fieldName, path);
        const fieldPath = utils.addPath(path, field.name);

        return [
          fieldName,
          field instanceof LeafCreationInput
            ? fieldValue
            : field instanceof EdgeCreationInput
            ? fieldValue && {
                [EdgeCreationInputAction.CONNECT]: await dependencyGraph
                  .getNodeData(fieldValue)
                  .getIdentifier(context),
              }
            : field instanceof MultipleReverseEdgeCreationInput
            ? fieldValue && {
                [MultipleReverseEdgeCreationInputAction.CREATE_SOME]:
                  await Promise.all(
                    utils
                      .resolveArrayable(fieldValue)
                      .map((data, index) =>
                        extractData(
                          dependencyGraph,
                          field.reverseEdge.head,
                          data,
                          context,
                          utils.addPath(fieldPath, index),
                        ),
                      ),
                  ),
              }
            : field instanceof UniqueReverseEdgeCreationInput
            ? fieldValue && {
                [UniqueReverseEdgeCreationInputAction.CREATE]:
                  await extractData(
                    dependencyGraph,
                    field.reverseEdge.head,
                    fieldValue,
                    context,
                    fieldPath,
                  ),
              }
            : fieldValue,
        ];
      }),
    ),
  );
}

export class NodeFixture<TRequestContext extends object = any> {
  readonly #path: utils.Path;

  public constructor(
    public readonly seeding: Seeding<TRequestContext>,
    public readonly node: Node<TRequestContext>,
    public readonly reference: NodeFixtureReference,
    public readonly data: NodeFixtureData,
    path: utils.Path,
  ) {
    utils.assertPlainObject(data, path);

    utils.aggregateGraphError<string, void>(
      Object.keys(data),
      (_, fieldName) => {
        node.creationInputType.getFieldByName(fieldName, path);
      },
      undefined,
      { path },
    );

    utils.aggregateGraphError<FieldCreationInput, void>(
      node.creationInputType.requiredFields,
      (_, field) => {
        if (data[field.name] === undefined) {
          throw new utils.UnexpectedUndefinedError(field.name, { path });
        }
      },
      undefined,
      { path },
    );

    this.#path = path;
  }

  @Memoize()
  public get dependencies(): ReadonlySet<NodeFixtureReference> {
    return extractDependencies(
      this.seeding.dependencyGraph,
      this.node,
      this.data,
      this.#path,
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
    const data = await extractData(
      this.seeding.dependencyGraph,
      this.node,
      this.data,
      context,
      this.#path,
    );

    return this.node
      .getMutationByKey('create-one')
      .execute(context, { data, selection: this.node.selection }, this.#path);
  }

  @Memoize((context: TRequestContext) => context)
  public async getIdentifier(
    context: TRequestContext,
  ): Promise<UniqueConstraintValue> {
    const nodeValue = await this.load(context);

    return this.node.identifier.parseValue(nodeValue);
  }
}
