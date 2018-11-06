import { GraphQLNonNullDecorator, Maybe, SuperMapOfNamedObject } from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLScalarType,
} from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Component, Field, InverseRelation, Relation } from '../../resource';
import { FieldValue } from '../../resource/component';
import { AbstractInputType } from '../abstract-type';

export type CreateRelationInputValue = { [actionName in RelationActionId]?: any };

export type CreateInputValue =
  | ({ [fieldName: string]: Maybe<FieldValue> } & { [relationName: string]: Maybe<CreateRelationInputValue> })
  | boolean;

export interface CreateAction {
  name: string;
  config: GraphQLInputFieldConfig;
}

export class CreateActionMap extends SuperMapOfNamedObject<CreateAction> {}

enum FieldAction {
  set,
}

type FieldActionId = keyof typeof FieldAction;

enum RelationAction {
  connect,
  create,
  update,
}

type RelationActionId = keyof typeof RelationAction;

enum InverseRelationAction {}

type InverseRelationActionId = keyof typeof InverseRelationAction;

export class CreateInputType extends AbstractInputType {
  @Memoize(({ name }: Field) => name)
  protected getFieldActionFieldConfig(field: Field): Maybe<GraphQLInputFieldConfig> {
    if (!field.isFullyManaged()) {
      return {
        description: field.description,
        type: GraphQLNonNullDecorator(field.getType(), field.isRequired()),
      };
    }

    return null;
  }

  @Memoize(({ name }: Relation) => name)
  protected getRelationActionFieldConfig(relation: Relation): Maybe<GraphQLInputFieldConfig> {
    if (!relation.isFullyManaged()) {
      return {
        description: relation.description,
        type: GraphQLNonNullDecorator(
          new GraphQLInputObjectType({
            name: [relation.getFrom().name, 'Create', relation.pascalCasedName, 'Input'].filter(Boolean).join(''),
            fields: () => {
              const fields: Record<RelationActionId, GraphQLInputFieldConfig> = {
                connect: {
                  description: `Connect an existing "${relation.getTo()}" node to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: relation
                    .getTo()
                    .getInputType('WhereUnique')
                    .getGraphQLType(),
                },

                create: {
                  description: `Create a new "${relation.getTo()}" node and connect it to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: relation
                    .getTo()
                    .getInputType('Create')
                    .getGraphQLType(),
                },

                update: {
                  description: `Update an existing "${relation.getTo()}" node and connect it to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: relation
                    .getTo()
                    .getMutation('UpdateOne')
                    .getGraphQLFieldConfigArgsAsType(),
                },
              };

              return fields;
            },
          }),
          relation.isRequired(),
        ),
      };
    }

    return null;
  }

  @Memoize(({ name }: InverseRelation) => name)
  protected getInverseRelationActionFieldConfig(inverseRelation: InverseRelation): Maybe<GraphQLInputFieldConfig> {
    return null;
  }

  @Memoize((forcedComponent?: Component) => (forcedComponent ? forcedComponent.name : ''))
  public getActionMap(forcedComponent?: Component): CreateActionMap {
    const actionMap = new CreateActionMap();

    for (const field of this.resource.getFieldSet()) {
      if (!(forcedComponent && forcedComponent === field)) {
        const fieldConfig = this.getFieldActionFieldConfig(field);
        if (fieldConfig) {
          const name = field.name;

          actionMap.set(name, {
            name,
            config: fieldConfig,
          });
        }
      }
    }

    for (const relation of this.resource.getRelationSet()) {
      if (!(forcedComponent && forcedComponent === relation)) {
        const fieldConfig = this.getRelationActionFieldConfig(relation);
        if (fieldConfig) {
          const name = relation.name;

          actionMap.set(name, {
            name,
            config: fieldConfig,
          });
        }
      }
    }

    for (const inverseRelation of this.resource.getInverseRelationSet()) {
      const fieldConfig = this.getInverseRelationActionFieldConfig(inverseRelation);
      if (fieldConfig) {
        const name = inverseRelation.name;

        actionMap.set(name, {
          name,
          config: fieldConfig,
        });
      }
    }

    return actionMap;
  }

  @Memoize((forcedComponent?: Component) => (forcedComponent ? forcedComponent.name : ''))
  public getGraphQLType(forcedComponent?: Component): GraphQLInputObjectType | GraphQLScalarType {
    const actionMap = this.getActionMap(forcedComponent);

    return actionMap.size > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            forcedComponent ? `WithForced${forcedComponent.pascalCasedName}` : null,
            'CreateInput',
          ].join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            for (const [name, { config }] of actionMap) {
              fields[name] = config;
            }

            return fields;
          },
        })
      : GraphQLBoolean;
  }
}
