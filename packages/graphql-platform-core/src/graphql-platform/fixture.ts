import { Entries, fromEntries } from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import { OperationDefinitionNode, print } from 'graphql';
import { Logger } from 'winston';
import { GraphQLPlatform, GraphQLRequest } from '../graphql-platform';
import { CreateOneDataInputValue } from './operation';
import { AnyResource, Relation, SerializedFieldValue } from './resource';
import { TypeKind, WhereUniqueInputValue } from './type';

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
  readonly logger?: Logger;
  protected id?: WhereUniqueInputValue;

  public constructor(
    readonly name: string,
    readonly resource: AnyResource,
    readonly data: FixtureData,
    protected graph: FixtureGraph,
    protected gp: GraphQLPlatform,
  ) {
    this.logger = gp.getLogger();
  }

  public toString(): string {
    return `${this.resource}.${this.name}`;
  }

  public getRelatedFixture(relation: Relation): Fixture | null {
    this.resource.getRelationMap().assert(relation);

    const relationValue = this.data[relation.name];

    if (relationValue == null) {
      if (relation.isRequired()) {
        throw new Error(`In the fixture "${this.name}", the relation "${relation}" can't be null.`);
      }
    } else if (!(typeof relationValue === 'string' && this.graph.hasNode(relationValue))) {
      throw new Error(
        `In the fixture "${this.name}", the relation "${relation}" has to reference an "${relation.getTo()}" fixture.`,
      );
    }

    return relationValue ? this.graph.getNodeData(relationValue) : null;
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
                value: this.resource.getMutation('CreateOne').getDataType().name,
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

  public getCreateMutationVariables(): GraphQLRequest['variableValues'] {
    return {
      data: fromEntries([
        // Fields
        ...[...this.resource.getFieldSet()].map(field =>
          !field.isFullyManaged() ? [field.name, this.data[field.name] as FixtureFieldData] : undefined,
        ),
        // Relations
        ...[...this.resource.getRelationSet()].map(relation => {
          if (!relation.isFullyManaged()) {
            const relatedFixture = this.getRelatedFixture(relation);
            if (relatedFixture) {
              return [relation.name, { connect: relatedFixture.assertId() }];
            }
          }
        }),
      ] as Entries<CreateOneDataInputValue>),
    };
  }

  public getCreateMutation(): GraphQLRequest {
    return {
      source: this.getCreateMutationSource(),
      variableValues: this.getCreateMutationVariables(),
    };
  }

  public async load(contextValue?: GraphQLRequest['contextValue']): Promise<void> {
    try {
      const { id } = await this.gp.execute<{ id: WhereUniqueInputValue }>({
        ...this.getCreateMutation(),
        contextValue,
      });

      this.id = this.resource.getInputType('WhereUnique').assert(id);
    } catch (error) {
      this.logger && this.logger.error(error);

      throw error;
    }
  }

  public assertId(): WhereUniqueInputValue {
    if (!this.id) {
      throw new Error(`The fixture "${this.name}" is not loaded yet.`);
    }

    return this.id;
  }
}
