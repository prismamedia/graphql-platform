import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, NodeValue } from '../node.js';
import type { Seeding } from '../seeding.js';
import type { UniqueConstraintValue } from './definition.js';
import type { NodeCreationInputValue } from './type.js';
import { EdgeCreationInputAction } from './type/input/creation/field.js';

export type NodeFixtureReference = string;

export type NodeFixtureData = utils.PlainObject;

export class NodeFixture<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public readonly dependencies: ReadonlySet<NodeFixtureReference>;

  public constructor(
    public readonly seeding: Seeding<TRequestContext, TConnector>,
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly reference: NodeFixtureReference,
    public readonly data: NodeFixtureData,
  ) {
    if (typeof reference !== 'string') {
      throw new utils.UnexpectedValueError('a string', reference);
    }

    if (!utils.isPlainObject(data)) {
      throw new utils.UnexpectedValueError('a plain-object', data);
    }

    this.dependencies = new Set(
      Array.from(this.node.edgesByName.values()).reduce<NodeFixtureReference[]>(
        (dependencies, edge) => {
          const maybeEdgeReference = data[edge.name];
          if (maybeEdgeReference != null) {
            dependencies.push(maybeEdgeReference);
          }

          return dependencies;
        },
        [],
      ),
    );
  }

  @Memoize()
  public get dependents(): ReadonlySet<NodeFixtureReference> {
    return new Set(
      Array.from(this.seeding.fixturesByReference.values()).reduce<
        NodeFixtureReference[]
      >((dependents, fixture) => {
        if (fixture.dependencies.has(this.reference)) {
          dependents.push(fixture.reference);
        }

        return dependents;
      }, []),
    );
  }

  @Memoize((context: TRequestContext) => context)
  public async getCreationInputValue(
    context: TRequestContext,
  ): Promise<NonNullable<NodeCreationInputValue>> {
    const maybeValue = Object.fromEntries(
      await Promise.all(
        Object.entries(this.data).map(async ([componentName, value]) => [
          componentName,
          this.node.edgesByName.has(componentName)
            ? {
                [EdgeCreationInputAction.CONNECT]:
                  await this.seeding.fixturesByReference
                    .get(value)!
                    .getIdentifier(context),
              }
            : value,
        ]),
      ),
    );

    return this.node.creationInputType.parseValue(maybeValue) as any;
  }

  @Memoize((context: TRequestContext) => context)
  public async load(context: TRequestContext): Promise<NodeValue> {
    const data = await this.getCreationInputValue(context);

    return this.node
      .getMutationByKey('create-one')
      .execute({ data, selection: this.node.selection }, context) as any;
  }

  @Memoize((context: TRequestContext) => context)
  public async getIdentifier(
    context: TRequestContext,
  ): Promise<UniqueConstraintValue> {
    const nodeValue = await this.load(context);

    return this.node.identifier.parseValue(nodeValue);
  }
}
