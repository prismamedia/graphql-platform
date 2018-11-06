import { DepGraph } from 'dependency-graph';
import { OperationDefinitionNode, print, printError } from 'graphql';
import { GraphQLPlatform, Request } from '../graphql-platform';
import { Field, FieldValue, Relation, Resource } from './resource';
import { TypeKind } from './type';
import { CreateInputValue, WhereUniqueInputValue } from './type/input';

export class FixtureGraph extends DepGraph<Fixture> {}

export type FixtureData = {
  [componentName: string]: null | FieldValue | Fixture['name'];
};

export type FixtureDataMap = {
  [fixtureName: string]: FixtureData;
};

export class Fixture {
  protected id?: WhereUniqueInputValue;

  public constructor(
    readonly name: string,
    readonly resource: Resource,
    readonly data: FixtureData,
    protected graph: FixtureGraph,
    protected gp: GraphQLPlatform,
  ) {}

  public toString(): string {
    return `${this.resource}.${this.name}`;
  }

  public getFieldValue(field: Field): FieldValue | undefined {
    this.resource.getFieldMap().assert(field);

    return field.getValue(this.data);
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
                value: this.resource.getInputType('Create').getGraphQLType().name,
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

  public getCreateMutationVariables(): Request['variableValues'] {
    const data: CreateInputValue = {};

    this.resource.getFieldSet().forEach(field => {
      if (!field.isFullyManaged()) {
        Object.assign(data, { [field.name]: this.getFieldValue(field) });
      }
    });

    this.resource.getRelationSet().forEach(relation => {
      if (!relation.isFullyManaged()) {
        const relatedFixture = this.getRelatedFixture(relation);
        if (relatedFixture) {
          Object.assign(data, { [relation.name]: { connect: relatedFixture.assertId() } });
        }
      }
    });

    return {
      data,
    };
  }

  public getCreateMutation(): Request {
    return {
      source: this.getCreateMutationSource(),
      variableValues: this.getCreateMutationVariables(),
    };
  }

  public async load(contextValue?: Request['contextValue']): Promise<void> {
    const { data, errors } = await this.gp.execute<{ id: WhereUniqueInputValue }>({
      ...this.getCreateMutation(),
      contextValue,
    });

    if (errors && errors.length > 0) {
      const error = errors[0];

      console.error(printError(error));
      throw error;
    }

    if (!data) {
      throw new Error('An error occured.');
    }

    this.id = this.resource.getInputType('WhereUnique').assert(data.id);
  }

  public assertId(): WhereUniqueInputValue {
    if (!this.id) {
      throw new Error(`The fixture "${this.name}" is not loaded yet.`);
    }

    return this.id;
  }
}
