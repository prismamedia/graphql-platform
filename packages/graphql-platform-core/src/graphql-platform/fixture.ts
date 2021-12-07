import {
  Entries,
  Entry,
  fromEntries,
  Maybe,
} from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import { OperationDefinitionNode, print } from 'graphql';
import { AnyGraphQLPlatform, GraphQLRequest } from '../graphql-platform';
import {
  CreateOneDataInputValue,
  CreateOneDataRelationActionKind,
} from './operation';
import { AnyResource, Relation, SerializedFieldValue } from './resource';
import { AnyInverseRelation } from './resource/component';
import { SerializedWhereUniqueInputValue, TypeKind } from './type';

export class FixtureGraph extends DepGraph<Fixture> {}

export type FixtureFieldData = SerializedFieldValue;

export type FixtureRelationData = null | Fixture['name'];

export type FixtureComponentData = FixtureFieldData | FixtureRelationData;

export type FixtureData = {
  [componentName: string]: FixtureComponentData;
};

export type FixtureDataMap = {
  [fixtureName: string]: FixtureData;
};

export class Fixture {
  #id: Promise<SerializedWhereUniqueInputValue> | undefined;

  public constructor(
    readonly name: string,
    readonly resource: AnyResource,
    readonly data: FixtureData,
    protected graph: FixtureGraph,
    protected gp: AnyGraphQLPlatform,
  ) {
    // Do not accept extra-fields (fail early)
    for (const componentName of Object.keys(data)) {
      const component = resource.getComponentMap().get(componentName);
      if (!component || component.isFullyManaged()) {
        throw new Error(
          `In the fixture "${name}", the component "${componentName}" can't be provided`,
        );
      }
    }
  }

  public toString(): string {
    return `${this.resource}.${this.name}`;
  }

  public getDependants(inverseRelation: AnyInverseRelation): Fixture[] {
    this.resource.getInverseRelationMap().assert(inverseRelation);

    const fixtures: Fixture[] = [];

    for (const fixtureName of this.graph.dependantsOf(this.name, true)) {
      const fixture = this.graph.getNodeData(fixtureName);
      if (
        fixture.resource === inverseRelation.getTo() &&
        fixture.getDependency(inverseRelation.getInverse()) === this
      ) {
        fixtures.push(fixture);
      }
    }

    return fixtures;
  }

  public getDependency(relation: Relation): Fixture | null {
    this.resource.getRelationMap().assert(relation);

    const relationValue = this.data[relation.name];

    if (relationValue == null) {
      if (relation.isRequired()) {
        throw new Error(
          `In the fixture "${this.name}", the relation "${relation}" can't be null.`,
        );
      }
    } else if (
      !(typeof relationValue === 'string' && this.graph.hasNode(relationValue))
    ) {
      throw new Error(
        `In the fixture "${
          this.name
        }", the relation "${relation}" has to reference an "${relation.getTo()}" fixture, got: ${relationValue}`,
      );
    }

    return relationValue ? this.graph.getNodeData(relationValue) : null;
  }

  public explain() {
    const dependencyMap = new Map(
      <[string, string][]>[...this.resource.getRelationSet()]
        .map((relation): Maybe<[string, string]> => {
          const dependency = this.getDependency(relation);

          return dependency ? [relation.name, dependency.name] : null;
        })
        .filter(Boolean),
    );

    const dependantMap = new Map(
      <[string, string[]][]>[...this.resource.getInverseRelationSet()]
        .map((inverseRelation): Maybe<[string, string[]]> => {
          const dependants = this.getDependants(inverseRelation);

          return dependants.length > 0
            ? [inverseRelation.name, dependants.map((fixture) => fixture.name)]
            : null;
        })
        .filter(Boolean),
    );

    return Object.fromEntries(
      <any>(
        [
          dependencyMap.size > 0 ? ['dependencyMap', dependencyMap] : null,
          dependantMap.size > 0 ? ['dependantMap', dependantMap] : null,
        ].filter(Boolean)
      ),
    );
  }

  public getCreateMutationAST(): OperationDefinitionNode {
    const operationDefinitionNode: OperationDefinitionNode = {
      kind: 'OperationDefinition',
      operation: 'mutation',
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: {
              kind: 'Name',
              value: 'data',
            },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: {
                kind: 'Name',
                value: this.resource.getMutation('CreateOne').getDataType()
                  .name,
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {
              kind: 'Name',
              value: this.resource.getMutation('CreateOne').name,
            },
            alias: {
              kind: 'Name',
              value: 'id',
            },
            arguments: [
              {
                kind: 'Argument',
                name: {
                  kind: 'Name',
                  value: 'data',
                },
                value: {
                  kind: 'Variable',
                  name: {
                    kind: 'Name',
                    value: 'data',
                  },
                },
              },
            ],
            selectionSet: this.resource
              .getFirstPublicUnique()
              .getSelectionNode(TypeKind.Output)
              .toAST(),
          },
        ],
      },
    };

    return operationDefinitionNode;
  }

  public getCreateMutationSource(): string {
    return print(this.getCreateMutationAST());
  }

  public async getCreateMutationVariables(
    contextValue?: GraphQLRequest['contextValue'],
  ): Promise<GraphQLRequest['variableValues']> {
    return {
      data: fromEntries(
        (await Promise.all([
          // Fields
          ...[...this.resource.getFieldSet()].map(
            async (field): Promise<Entry<FixtureData> | undefined> =>
              !field.isFullyManaged()
                ? [field.name, this.data[field.name] as any]
                : undefined,
          ),

          // Relations
          ...[...this.resource.getRelationSet()].map(
            async (relation): Promise<Entry<FixtureData> | undefined> => {
              if (!relation.isFullyManaged()) {
                const relatedFixture = this.getDependency(relation);
                if (relatedFixture) {
                  return [
                    relation.name,
                    {
                      [CreateOneDataRelationActionKind.Connect]:
                        await relatedFixture.load(contextValue),
                    } as any,
                  ];
                }
              }
            },
          ),
        ])) as Entries<CreateOneDataInputValue>,
      ),
    };
  }

  public async getCreateMutation(
    contextValue?: GraphQLRequest['contextValue'],
  ): Promise<GraphQLRequest> {
    return {
      source: this.getCreateMutationSource(),
      variableValues: await this.getCreateMutationVariables(contextValue),
    };
  }

  protected async doLoad(
    contextValue?: GraphQLRequest['contextValue'],
  ): Promise<SerializedWhereUniqueInputValue> {
    const { id } = await this.gp.execute<{
      id: SerializedWhereUniqueInputValue;
    }>({
      ...(await this.getCreateMutation()),
      contextValue,
    });

    return id;
  }

  public async load(
    contextValue?: GraphQLRequest['contextValue'],
  ): Promise<SerializedWhereUniqueInputValue> {
    // Only the first call will run the mutation (= "doLoad"), the others will wait for the result
    if (!this.#id) {
      this.#id = this.doLoad(contextValue);
    }

    return this.#id;
  }
}
