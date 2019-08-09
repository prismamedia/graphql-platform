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
  GraphQLScalarType,
} from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Field, InverseRelation, Relation } from '../../resource';
import { FieldValue } from '../../resource/component';
import { AbstractInputType } from '../abstract-type';

export type CreateRelationInputValue = Partial<Record<CreateRelationActionKind, any>>;

export type CreateInverseRelationInputValue = Partial<Record<CreateInverseRelationActionKind, MaybeArray<any>>>;

export type CreateInputValue =
  | ({ [fieldName: string]: Maybe<FieldValue> } & { [relationName: string]: Maybe<CreateRelationInputValue> } & {
      [inverseRelationName: string]: Maybe<CreateInverseRelationInputValue>;
    })
  | boolean;

export interface CreateAction {
  name: string;
  config: GraphQLInputFieldConfig;
}

export class CreateActionMap extends SuperMapOfNamedObject<CreateAction> {}

export enum CreateFieldActionKind {
  Set = 'set',
}

export enum CreateRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Update = 'update',
  Upsert = 'upsert',
}

export const createRelationActionKinds = getEnumValues(CreateRelationActionKind);

export enum CreateInverseRelationActionKind {
  Connect = 'connect',
  Create = 'create',
}

export const createInverseRelationActionKinds = getEnumValues(CreateInverseRelationActionKind);

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
      const relatedResource = relation.getTo();

      return {
        description: `Nested actions for the "${relation}" relation`,
        type: GraphQLNonNullDecorator(
          new GraphQLInputObjectType({
            name: [relation.getFrom().name, 'Create', relation.pascalCasedName, 'Input'].filter(Boolean).join(''),
            fields: () => {
              const fields: GraphQLInputFieldConfigMap = {};

              fields[CreateRelationActionKind.Connect] = {
                description: `Connect an existing "${relatedResource}" node to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                type: relatedResource.getInputType('WhereUnique').getGraphQLType(),
              };

              if (relatedResource.getMutation('UpdateOne').isPublic()) {
                fields[CreateRelationActionKind.Update] = {
                  description: `Update an existing "${relatedResource}" node and connect it to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: new GraphQLInputObjectType({
                    name: [relation.getFrom().name, 'Create', 'NestedUpdate', relation.pascalCasedName, 'Input']
                      .filter(Boolean)
                      .join(''),
                    fields: () => relatedResource.getMutation('UpdateOne').getGraphQLFieldConfigArgs(),
                  }),
                };
              }

              if (relatedResource.getMutation('CreateOne').isPublic()) {
                fields[CreateRelationActionKind.Create] = {
                  description: `Create a new "${relatedResource}" node and connect it to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: relatedResource.getInputType('Create').getGraphQLType(),
                };
              }

              if (relatedResource.getMutation('UpsertOne').isPublic()) {
                fields[CreateRelationActionKind.Upsert] = {
                  description: `Create or update a "${relatedResource}" node and connect it to the new "${relation.getFrom()}" node, through the "${relation}" relation.`,
                  type: new GraphQLInputObjectType({
                    name: [relation.getFrom().name, 'Create', 'NestedUpsert', relation.pascalCasedName, 'Input']
                      .filter(Boolean)
                      .join(''),
                    fields: () => relatedResource.getMutation('UpsertOne').getGraphQLFieldConfigArgs(),
                  }),
                };
              }

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
    const relation = inverseRelation.getInverse();
    const relatedResource = inverseRelation.getTo();

    if (
      (!relation.isImmutable() && relatedResource.getMutation('UpdateOne').isPublic()) ||
      relatedResource.getMutation('CreateOne').isPublic()
    ) {
      return {
        description: `Nested actions for the "${inverseRelation}" relation`,
        type: new GraphQLInputObjectType({
          name: [inverseRelation.getFrom().name, 'Create', inverseRelation.pascalCasedName, 'Input']
            .filter(Boolean)
            .join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            if (!relation.isImmutable() && relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[CreateInverseRelationActionKind.Connect] = {
                description: inverseRelation.isToMany()
                  ? `Connect existing "${relatedResource}" nodes to the new "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Connect an existing "${relatedResource}" node to the new "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getInputType('WhereUnique').getGraphQLType(),
                    inverseRelation.isToMany(),
                  ),
                  inverseRelation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[CreateInverseRelationActionKind.Create] = {
                description: inverseRelation.isToMany()
                  ? `Create new "${relatedResource}" nodes and connect them to the new "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`
                  : `Create a new "${relatedResource}" node and connect it to the new "${inverseRelation.getFrom()}" node, through the "${inverseRelation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getInputType('Create').getGraphQLType(relation),
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
  public getActionMap(forcedRelation?: Relation): CreateActionMap {
    const actionMap = new CreateActionMap();

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
