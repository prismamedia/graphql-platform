import {
  getEnumValues,
  GraphQLListDecorator,
  GraphQLNonNullDecorator,
  Maybe,
  MaybeArray,
  SuperMapOfNamedObject,
} from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLScalarType,
} from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Field, FieldValue, InverseRelation, Relation } from '../../resource';
import { AbstractInputType } from '../abstract-type';

export type UpdateRelationInputValue = Partial<Record<UpdateRelationActionKind, any>>;

export type UpdateInverseRelationInputValue = Partial<Record<UpdateInverseRelationActionKind, MaybeArray<any>>>;

export type UpdateInputValue =
  | ({ [fieldName: string]: Maybe<FieldValue> } & { [relationName: string]: Maybe<UpdateRelationInputValue> } & {
      [inverseRelationName: string]: Maybe<UpdateInverseRelationInputValue>;
    })
  | boolean;

export interface UpdateAction {
  name: string;
  config: GraphQLInputFieldConfig;
}

export class UpdateActionMap extends SuperMapOfNamedObject<UpdateAction> {}

export enum UpdateFieldActionKind {
  Set = 'set',
}

export enum UpdateRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Disconnect = 'disconnect',
  Update = 'update',
  Upsert = 'upsert',
}

export const updateRelationActionKinds = getEnumValues(UpdateRelationActionKind);

export enum UpdateInverseRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Delete = 'delete',
  Disconnect = 'disconnect',
  Update = 'update',
  Upsert = 'upsert',
}

export const updateInverseRelationActionKinds = [
  ...new Set([
    UpdateInverseRelationActionKind.Delete,
    UpdateInverseRelationActionKind.Disconnect,
    ...getEnumValues(UpdateInverseRelationActionKind),
  ]),
];

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
      const relatedResource = relation.getTo();

      return {
        description: `Nested actions for the "${relation}" relation`,
        type: new GraphQLInputObjectType({
          name: [relation.getFrom().name, 'Update', relation.pascalCasedName, 'Input'].filter(Boolean).join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            fields[UpdateRelationActionKind.Connect] = {
              description: `Connect an existing "${relation.getTo()}" node to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
              type: relatedResource.getInputType('WhereUnique').getGraphQLType(),
            };

            if (relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[UpdateRelationActionKind.Update] = {
                description: `Update an existing "${relatedResource}" node and connect it to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: new GraphQLInputObjectType({
                  name: [relation.getFrom().name, 'Update', 'NestedUpdate', relation.pascalCasedName, 'Input']
                    .filter(Boolean)
                    .join(''),
                  fields: () => relatedResource.getMutation('UpdateOne').getGraphQLFieldConfigArgs(),
                }),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[UpdateRelationActionKind.Create] = {
                description: `Create a new "${relation.getTo()}" node and connect it to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: relatedResource.getInputType('Create').getGraphQLType(),
              };
            }

            if (relatedResource.getMutation('UpsertOne').isPublic()) {
              fields[UpdateRelationActionKind.Upsert] = {
                description: `Create or update a "${relatedResource}" node and connect it to the existing "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: new GraphQLInputObjectType({
                  name: [relation.getFrom().name, 'Update', 'NestedUpsert', relation.pascalCasedName, 'Input']
                    .filter(Boolean)
                    .join(''),
                  fields: () => relatedResource.getMutation('UpsertOne').getGraphQLFieldConfigArgs(),
                }),
              };
            }

            if (relation.isNullable()) {
              fields[UpdateRelationActionKind.Disconnect] = {
                description: `Disconnect the current connected "${relation.getTo()}" node, if any, of the "${relation}" relation.`,
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
    const relation = inverseRelation.getInverse();
    const relatedResource = inverseRelation.getTo();

    if (
      (!relation.isImmutable() && relatedResource.getMutation('UpdateOne').isPublic()) ||
      relatedResource.getMutation('CreateOne').isPublic()
    ) {
      return {
        description: `Nested actions for the "${inverseRelation}" relation`,
        type: new GraphQLInputObjectType({
          name: [inverseRelation.getFrom().name, 'Update', inverseRelation.pascalCasedName, 'Input']
            .filter(Boolean)
            .join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            if (!relation.isImmutable() && relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[UpdateInverseRelationActionKind.Connect] = {
                description: inverseRelation.isToMany()
                  ? `Connect existing "${relatedResource}" nodes to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Connect an existing "${relatedResource}" node to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getInputType('WhereUnique').getGraphQLType(),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };

              if (relation.isNullable()) {
                fields[UpdateInverseRelationActionKind.Disconnect] = {
                  description: inverseRelation.isToMany()
                    ? `Disconnect existing "${relatedResource}" nodes of the "${inverseRelation}" relation.`
                    : `Disconnect an existing "${relatedResource}" node of the "${inverseRelation}" relation.`,
                  type: GraphQLListDecorator(
                    GraphQLNonNullDecorator(
                      relation.isInUnique()
                        ? relatedResource.getInputType('WhereUnique').getGraphQLType(relation, true)
                        : relatedResource.getInputType('WhereUnique').getGraphQLType(),
                      inverseRelation.isToMany(),
                    ),
                    inverseRelation.isToMany(),
                  ),
                };
              }
            }

            if (relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[UpdateInverseRelationActionKind.Update] = {
                description: inverseRelation.isToMany()
                  ? `Update existing "${relatedResource}" nodes and connect them to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Update an existing "${relatedResource}" node and connect it to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    new GraphQLInputObjectType({
                      name: [
                        inverseRelation.getFrom().name,
                        'Update',
                        'NestedUpdate',
                        inverseRelation.pascalCasedName,
                        'Input',
                      ]
                        .filter(Boolean)
                        .join(''),
                      fields: () => {
                        return {
                          where: {
                            type: inverseRelation.isToOne()
                              ? relatedResource.getInputType('WhereUnique').getGraphQLType(relation, false)
                              : relation.isInUnique()
                              ? GraphQLNonNull(
                                  relatedResource.getInputType('WhereUnique').getGraphQLType(relation, false),
                                )
                              : relatedResource.getInputType('WhereUnique').getGraphQLType(),
                          },
                          data: {
                            type: GraphQLNonNull(relatedResource.getInputType('Update').getGraphQLType(relation)),
                          },
                        };
                      },
                    }),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[UpdateInverseRelationActionKind.Create] = {
                description: inverseRelation.isToMany()
                  ? `Create new "${relatedResource}" nodes and connect them to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Create a new "${relatedResource}" node and connect it to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getInputType('Create').getGraphQLType(relation),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('UpsertOne').isPublic()) {
              fields[UpdateInverseRelationActionKind.Upsert] = {
                description: inverseRelation.isToMany()
                  ? `Upsert existing "${relatedResource}" nodes and connect them to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Upsert an existing "${relatedResource}" node and connect it to the existing "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    new GraphQLInputObjectType({
                      name: [
                        inverseRelation.getFrom().name,
                        'Update',
                        'NestedUpsert',
                        inverseRelation.pascalCasedName,
                        'Input',
                      ]
                        .filter(Boolean)
                        .join(''),
                      fields: () => {
                        return {
                          where: {
                            type: GraphQLNonNull(
                              relation.isInUnique()
                                ? relatedResource.getInputType('WhereUnique').getGraphQLType(relation, false)
                                : relatedResource.getInputType('WhereUnique').getGraphQLType(),
                            ),
                          },
                          update: {
                            type: GraphQLNonNull(relatedResource.getInputType('Update').getGraphQLType(relation)),
                          },
                          create: {
                            type: GraphQLNonNull(relatedResource.getInputType('Create').getGraphQLType(relation)),
                          },
                        };
                      },
                    }),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('DeleteOne').isPublic()) {
              fields[UpdateInverseRelationActionKind.Delete] = {
                description: inverseRelation.isToMany()
                  ? `Delete existing "${relatedResource}" nodes from the "${inverseRelation}" relation.`
                  : `Delete an existing "${relatedResource}" node from the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relation.isInUnique()
                      ? relatedResource.getInputType('WhereUnique').getGraphQLType(relation, true)
                      : relatedResource.getInputType('WhereUnique').getGraphQLType(),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };
            }

            return fields;
          },
        }),
      };
    }

    return null;
  }

  @Memoize((forcedRelation?: Relation) => (forcedRelation ? forcedRelation.name : ''))
  public getActionMap(forcedRelation?: Relation): UpdateActionMap {
    const actionMap = new UpdateActionMap();

    for (const field of this.resource.getFieldSet()) {
      const fieldConfig = this.getFieldActionFieldConfig(field);
      if (fieldConfig) {
        const name = field.name;

        actionMap.set(name, {
          name,
          config: fieldConfig,
        });
      }
    }

    for (const relation of this.resource.getRelationSet()) {
      if (!(forcedRelation && forcedRelation === relation)) {
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

  @Memoize((forcedRelation?: Relation) => (forcedRelation ? forcedRelation.name : ''))
  public getGraphQLType(forcedRelation?: Relation): GraphQLInputObjectType | GraphQLScalarType {
    const actionMap = this.getActionMap(forcedRelation);

    return actionMap.size > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            forcedRelation ? `WithForced${forcedRelation.pascalCasedName}` : null,
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
