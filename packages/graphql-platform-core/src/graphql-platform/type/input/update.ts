import { Maybe, SuperMapOfNamedObject } from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLScalarType,
} from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Component, Field, FieldValue, InverseRelation, Relation } from '../../resource';
import { AbstractInputType } from '../abstract-type';

export type UpdateRelationInputValue = { [actionName in RelationActionId]?: any };

export type UpdateInputValue =
  | ({ [fieldName: string]: Maybe<FieldValue> } & { [relationName: string]: Maybe<UpdateRelationInputValue> })
  | boolean;

export interface UpdateAction {
  name: string;
  config: GraphQLInputFieldConfig;
}

export class UpdateActionMap extends SuperMapOfNamedObject<UpdateAction> {}

enum FieldAction {
  set,
}

type FieldActionId = keyof typeof FieldAction;

enum RelationAction {
  connect,
  create,
  update,
  disconnect,
}

type RelationActionId = keyof typeof RelationAction;

enum InverseRelationAction {}

type InverseRelationActionId = keyof typeof InverseRelationAction;

export class UpdateInputType extends AbstractInputType {
  @Memoize(({ name }: Field) => name)
  protected getFieldActionFieldConfig(field: Field): Maybe<GraphQLInputFieldConfig> {
    if (!field.isFullyManaged() && !field.isImmutable()) {
      return {
        description: field.description,
        type: field.getType(),
      };
    }

    return null;
  }

  @Memoize(({ name }: Relation) => name)
  protected getRelationActionFieldConfig(relation: Relation): Maybe<GraphQLInputFieldConfig> {
    if (!relation.isFullyManaged() && !relation.isImmutable()) {
      return {
        description: relation.description,
        type: new GraphQLInputObjectType({
          name: [relation.getFrom().name, 'Update', relation.pascalCasedName, 'Input'].filter(Boolean).join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {
              connect: {
                description: `Connect an existing "${relation.getTo()}" node to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: relation
                  .getTo()
                  .getInputType('WhereUnique')
                  .getGraphQLType(),
              },

              create: {
                description: `Create a new "${relation.getTo()}" node and connect it to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: relation
                  .getTo()
                  .getInputType('Create')
                  .getGraphQLType(),
              },

              update: {
                description: `Update an existing "${relation.getTo()}" node and connect it to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: relation
                  .getTo()
                  .getMutation('UpdateOne')
                  .getGraphQLFieldConfigArgsAsType(),
              },
            };

            if (relation.isNullable()) {
              fields['disconnect'] = {
                description: `Disconnect the current "${relation.getTo()}" node, if any, of the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: GraphQLBoolean,
              };
            }

            return fields;
          },
        }),
      };
    }

    return null;
  }

  @Memoize(({ name }: InverseRelation) => name)
  protected getInverseRelationActionFieldConfig(inverseRelation: InverseRelation): Maybe<GraphQLInputFieldConfig> {
    return null;
  }

  @Memoize((forcedComponent?: Component) => (forcedComponent ? forcedComponent.name : ''))
  public getActionMap(forcedComponent?: Component): UpdateActionMap {
    const actionMap = new UpdateActionMap();

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
            'UpdateInput',
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
