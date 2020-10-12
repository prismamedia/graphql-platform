import {
  Entries,
  fromEntries,
  getEnumValues,
  GraphQLListDecorator,
  GraphQLNonNullDecorator,
  GraphQLOperationType,
  isNonEmptyPlainObject,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLBoolean,
  GraphQLFieldConfigArgumentMap,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLScalarType,
} from 'graphql';
import { AnyBaseContext, BaseContext } from '../../../graphql-platform';
import { ConnectorUpdateOperationArgs } from '../../connector';
import { OperationResolverParams } from '../../operation';
import {
  Component,
  Field,
  InvalidComponentValueError,
  InverseRelation,
  NodeValue,
  Relation,
  RelationValue,
  ResourceHookKind,
} from '../../resource';
import { NodeSource, TypeKind, WhereUniqueInputValue } from '../../type';
import { WhereInputValue } from '../../type/input';
import { AbstractOperation } from '../abstract-operation';
import { NodeNotFoundError } from '../error';
import { CreateOneDataRelationActionKind } from './create-one';
import {
  ComponentUpdate,
  FieldUpdate,
  RelationUpdate,
  UpdateOneRawValue,
  UpdateOneValue,
} from './update-one/value';

export * from './update-one/value';

export enum UpdateOneDataRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Disconnect = 'disconnect',
  Update = 'update',
  Upsert = 'upsert',
}

export const updateOneDataRelationActionKinds = getEnumValues(
  UpdateOneDataRelationActionKind,
);

export enum UpdateOneDataInverseRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Delete = 'delete',
  Disconnect = 'disconnect',
  Update = 'update',
  Upsert = 'upsert',
}

export const updateOneDataInverseRelationActionKinds = getEnumValues(
  UpdateOneDataInverseRelationActionKind,
);

export type UpdateOneDataInputValue = POJO;

export type UpdateOneOperationArgs = {
  where: WhereUniqueInputValue;
  data: UpdateOneDataInputValue;
};

export type UpdateOneOperationResult = NodeSource | null;

export class UpdateOneOperation extends AbstractOperation<
  UpdateOneOperationArgs,
  UpdateOneOperationResult
> {
  @Memoize()
  public isSupported(): boolean {
    return this.resource
      .getComponentSet()
      .some((component) => component.isMutable());
  }

  @Memoize()
  public get name(): string {
    return `update${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Update a single "${this.resource}" node.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return this.resource.getOutputType('Node').getGraphQLType();
  }

  @Memoize(({ name }: Component) => name)
  public isDataField(component: Component): boolean {
    return !component.isFullyManaged() && !component.isImmutable();
  }

  @Memoize(({ name }: Field) => name)
  protected getDataFieldConfig(
    field: Field,
  ): GraphQLInputFieldConfig | undefined {
    if (this.isDataField(field)) {
      return {
        description: field.description,
        type: field.getType(),
      };
    }
  }

  @Memoize(({ name }: Relation) => name)
  protected getDataRelationConfig(
    relation: Relation,
  ): GraphQLInputFieldConfig | undefined {
    const resource = relation.getFrom();
    const relatedResource = relation.getTo();

    if (this.isDataField(relation)) {
      return {
        description: [
          `Actions for the "${relation}" relation`,
          relation.description,
        ]
          .filter(Boolean)
          .join(': '),
        type: new GraphQLInputObjectType({
          name: [
            resource.name,
            'Nested',
            relation.pascalCasedName,
            'UpdateInput',
          ].join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            fields[UpdateOneDataRelationActionKind.Connect] = {
              description: `Connect an existing "${relatedResource}" node to the existing "${resource}" node, through the "${relation}" relation.`,
              type: relatedResource
                .getInputType('WhereUnique')
                .getGraphQLType(),
            };

            if (relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[UpdateOneDataRelationActionKind.Update] = {
                description: `Update an existing "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: new GraphQLInputObjectType({
                  name: [
                    resource.name,
                    'NestedUpdate',
                    relation.pascalCasedName,
                    'UpdateInput',
                  ].join(''),
                  fields: () =>
                    relatedResource
                      .getMutation('UpdateOne')
                      .getGraphQLFieldConfigArgs(),
                }),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[UpdateOneDataRelationActionKind.Create] = {
                description: `Create a new "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: relatedResource.getMutation('CreateOne').getDataType(),
              };
            }

            if (relatedResource.getMutation('UpsertOne').isPublic()) {
              fields[UpdateOneDataRelationActionKind.Upsert] = {
                description: `Create or update a "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: new GraphQLInputObjectType({
                  name: [
                    resource.name,
                    'NestedUpsert',
                    relation.pascalCasedName,
                    'UpdateInput',
                  ].join(''),
                  fields: () =>
                    relatedResource
                      .getMutation('UpsertOne')
                      .getGraphQLFieldConfigArgs(),
                }),
              };
            }

            if (relation.isNullable()) {
              fields[UpdateOneDataRelationActionKind.Disconnect] = {
                description: `Disconnect the current connected "${relatedResource}" node, if any, of the "${relation}" relation.`,
                type: GraphQLBoolean,
              };
            }

            return fields;
          },
        }),
      };
    }
  }

  @Memoize(({ name }: InverseRelation) => name)
  protected getDataInverseRelationConfig(
    relation: InverseRelation,
  ): GraphQLInputFieldConfig | undefined {
    const resource = relation.getFrom();
    const relatedResource = relation.getTo();

    if (
      (relatedResource.getMutation('UpdateOne').isPublic() &&
        !relation.getInverse().isFullyManaged() &&
        relation.getInverse().isMutable()) ||
      relatedResource.getMutation('CreateOne').isPublic() ||
      relatedResource.getMutation('DeleteOne').isPublic()
    ) {
      return {
        description: [
          `Actions for the "${relation}" relation`,
          relation.description,
        ]
          .filter(Boolean)
          .join(': '),
        type: new GraphQLInputObjectType({
          name: [
            resource.name,
            'Nested',
            relation.pascalCasedName,
            'UpdateInput',
          ].join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            if (
              relatedResource.getMutation('UpdateOne').isPublic() &&
              relation.getInverse().isMutable()
            ) {
              fields[UpdateOneDataInverseRelationActionKind.Connect] = {
                description: relation.isToMany()
                  ? `Connect existing "${relatedResource}" nodes to the existing "${resource}" node, through the "${relation}" relation.`
                  : `Connect an existing "${relatedResource}" node to the existing "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource
                      .getInputType('WhereUnique')
                      .getGraphQLType(),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };

              if (relation.getInverse().isNullable()) {
                fields[UpdateOneDataInverseRelationActionKind.Disconnect] = {
                  description: relation.isToMany()
                    ? `Disconnect existing "${relatedResource}" nodes of the "${relation}" relation.`
                    : `Disconnect an existing "${relatedResource}" node of the "${relation}" relation.`,
                  type: GraphQLListDecorator(
                    GraphQLNonNullDecorator(
                      relation.getInverse().isInUnique()
                        ? relatedResource
                            .getInputType('WhereUnique')
                            .getGraphQLType(relation.getInverse(), true)
                        : relatedResource
                            .getInputType('WhereUnique')
                            .getGraphQLType(),
                      relation.isToMany(),
                    ),
                    relation.isToMany(),
                  ),
                };
              }
            }

            if (relatedResource.getMutation('UpdateOne').isPublic()) {
              fields[UpdateOneDataInverseRelationActionKind.Update] = {
                description: relation.isToMany()
                  ? `Update existing "${relatedResource}" nodes and connect them to the existing "${resource}" node, through the "${relation}" relation.`
                  : `Update an existing "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    new GraphQLInputObjectType({
                      name: [
                        resource.name,
                        'NestedUpdate',
                        relation.pascalCasedName,
                        'UpdateInput',
                      ].join(''),
                      fields: () => {
                        const whereUniqueType = relation
                          .getInverse()
                          .isInUnique()
                          ? relatedResource
                              .getInputType('WhereUnique')
                              .getGraphQLType(
                                relation.getInverse(),
                                relation.getInverse().isImmutable(),
                              )
                          : relatedResource
                              .getInputType('WhereUnique')
                              .getGraphQLType();

                        return {
                          ...(whereUniqueType instanceof GraphQLInputObjectType
                            ? {
                                where: {
                                  type: GraphQLNonNull(whereUniqueType),
                                },
                              }
                            : {}),
                          data: {
                            type: GraphQLNonNull(
                              relatedResource
                                .getMutation('UpdateOne')
                                .getDataType(relation.getInverse()),
                            ),
                          },
                        };
                      },
                    }),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[UpdateOneDataInverseRelationActionKind.Create] = {
                description: relation.isToMany()
                  ? `Create new "${relatedResource}" nodes and connect them to the existing "${resource}" node, through the "${relation}" relation.`
                  : `Create a new "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource
                      .getMutation('CreateOne')
                      .getDataType(relation.getInverse()),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('UpsertOne').isPublic()) {
              fields[UpdateOneDataInverseRelationActionKind.Upsert] = {
                description: relation.isToMany()
                  ? `Upsert existing "${relatedResource}" nodes and connect them to the existing "${resource}" node, through the "${relation}" relation.`
                  : `Upsert an existing "${relatedResource}" node and connect it to the existing "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    new GraphQLInputObjectType({
                      name: [
                        resource.name,
                        'NestedUpsert',
                        relation.pascalCasedName,
                        'UpdateInput',
                      ].join(''),
                      fields: () => {
                        const whereUniqueType = relation
                          .getInverse()
                          .isInUnique()
                          ? relatedResource
                              .getInputType('WhereUnique')
                              .getGraphQLType(
                                relation.getInverse(),
                                relation.getInverse().isImmutable(),
                              )
                          : relatedResource
                              .getInputType('WhereUnique')
                              .getGraphQLType();

                        return {
                          ...(whereUniqueType instanceof GraphQLInputObjectType
                            ? {
                                where: {
                                  type: GraphQLNonNull(whereUniqueType),
                                },
                              }
                            : {}),
                          update: {
                            type: GraphQLNonNull(
                              relatedResource
                                .getMutation('UpdateOne')
                                .getDataType(relation.getInverse()),
                            ),
                          },
                          create: {
                            type: GraphQLNonNull(
                              relatedResource
                                .getMutation('CreateOne')
                                .getDataType(relation.getInverse()),
                            ),
                          },
                        };
                      },
                    }),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('DeleteOne').isPublic()) {
              fields[UpdateOneDataInverseRelationActionKind.Delete] = {
                description: relation.isToMany()
                  ? `Delete existing "${relatedResource}" nodes from the "${relation}" relation.`
                  : `Delete an existing "${relatedResource}" node from the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relation.getInverse().isInUnique()
                      ? relatedResource
                          .getInputType('WhereUnique')
                          .getGraphQLType(relation.getInverse(), true)
                      : relatedResource
                          .getInputType('WhereUnique')
                          .getGraphQLType(),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };
            }

            return fields;
          },
        }),
      };
    }
  }

  @Memoize((forcedRelation?: Relation) =>
    forcedRelation ? forcedRelation.name : '',
  )
  public getDataType(
    forcedRelation?: Relation,
  ): GraphQLInputObjectType | GraphQLScalarType {
    forcedRelation && this.resource.assertComponent(forcedRelation);

    const fields: GraphQLInputFieldConfigMap = fromEntries([
      // Fields
      ...[...this.resource.getFieldSet()].map((field) => [
        field.name,
        this.getDataFieldConfig(field),
      ]),
      // Relations
      ...[...this.resource.getRelationSet()].map((relation) => [
        relation.name,
        forcedRelation && forcedRelation === relation
          ? undefined
          : this.getDataRelationConfig(relation),
      ]),
      // Inverse relations
      ...[...this.resource.getInverseRelationSet()].map((relation) => [
        relation.name,
        this.getDataInverseRelationConfig(relation),
      ]),
    ] as Entries<GraphQLInputFieldConfigMap>);

    return Object.keys(fields).length > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            forcedRelation
              ? `WithForced${forcedRelation.pascalCasedName}`
              : null,
            'UpdateInput',
          ].join(''),
          fields,
        })
      : GraphQLBoolean;
  }

  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      where: {
        type: GraphQLNonNull(
          this.resource.getInputType('WhereUnique').getGraphQLType(),
        ),
      },
      data: {
        type: GraphQLNonNull(this.getDataType()),
      },
    };
  }

  public async parseDataComponentMap(
    data: UpdateOneDataInputValue,
    context: BaseContext,
  ): Promise<UpdateOneRawValue> {
    return fromEntries(
      await Promise.all([
        // Fields
        ...[...this.resource.getFieldSet()].map(
          async (
            field,
          ): Promise<[string, FieldUpdate | undefined] | undefined> => {
            const fieldValue: FieldUpdate | undefined = data[field.name];
            if (typeof fieldValue !== 'undefined') {
              if (!this.isDataField(field)) {
                throw new InvalidComponentValueError(field, `cannot be set`);
              }

              return [field.name, fieldValue];
            }
          },
        ),
        // Relations
        ...[...this.resource.getRelationSet()].map(
          async (
            relation,
          ): Promise<[string, RelationUpdate | undefined] | undefined> => {
            const actions = data[relation.name];
            if (isNonEmptyPlainObject(actions)) {
              if (!this.isDataField(relation)) {
                throw new InvalidComponentValueError(relation, `cannot be set`);
              }

              if (
                !(
                  Object.keys(actions).length === 1 &&
                  updateOneDataRelationActionKinds.includes(
                    Object.keys(actions)[0] as any,
                  )
                )
              ) {
                throw new Error(
                  `The relation "${relation}" supports exactly 1 nested action among: ${updateOneDataRelationActionKinds.join(
                    ', ',
                  )}`,
                );
              }

              const actionKind = Object.keys(
                actions,
              )[0] as UpdateOneDataRelationActionKind;
              const actionValue = actions[actionKind];

              if (actionValue == null) {
                throw new Error(
                  `The relation "${relation}"'s nested action "${actionKind}" does not support an empty value`,
                );
              }

              // Returns only the selection we need (the targeted unique constraint)
              const selectionNode = relation
                .getToUnique()
                .getSelectionNode(TypeKind.Input);
              const relatedResource = relation.getTo();

              let relatedNode: NodeSource | null | undefined;
              switch (actionKind) {
                case UpdateOneDataRelationActionKind.Connect: {
                  relatedNode = await relatedResource
                    .getQuery('AssertOne')
                    .resolve({
                      args: { where: actionValue },
                      context,
                      selectionNode,
                    });
                  break;
                }

                case UpdateOneDataRelationActionKind.Disconnect: {
                  relatedNode = actionValue === true ? null : undefined;
                  break;
                }

                case UpdateOneDataRelationActionKind.Update: {
                  const updatedNode = await relatedResource
                    .getMutation('UpdateOne')
                    .resolve({ args: actionValue, context, selectionNode });

                  if (!updatedNode) {
                    throw new NodeNotFoundError(
                      relatedResource.getMutation('UpdateOne'),
                      actionValue.where,
                    );
                  }

                  relatedNode = updatedNode;
                  break;
                }

                case UpdateOneDataRelationActionKind.Create: {
                  relatedNode = await relatedResource
                    .getMutation('CreateOne')
                    .resolve({
                      args: { data: actionValue },
                      context,
                      selectionNode,
                    });
                  break;
                }

                case UpdateOneDataRelationActionKind.Upsert: {
                  relatedNode = await relatedResource
                    .getMutation('UpsertOne')
                    .resolve({ args: actionValue, context, selectionNode });
                  break;
                }

                default:
                  throw new Error(
                    `The relation "${relation}"'s nested action "${actionKind}" is not supported, yet`,
                  );
              }

              return [relation.name, relatedNode as RelationValue | undefined];
            }
          },
        ),
      ] as Promise<[string, ComponentUpdate] | undefined>[]),
    );
  }

  public async parseDataInverseRelationMap(
    data: UpdateOneDataInputValue,
    id: WhereUniqueInputValue,
    context: BaseContext,
  ): Promise<void> {
    await Promise.all(
      [...this.resource.getInverseRelationSet()].map(
        async (inverseRelation) => {
          const actions = data[inverseRelation.name];
          if (isNonEmptyPlainObject(actions)) {
            if (
              !Object.keys(actions).every((actionKind) =>
                updateOneDataInverseRelationActionKinds.includes(
                  actionKind as any,
                ),
              )
            ) {
              throw new Error(
                `The "${inverseRelation}" relation supports at least one action among: ${updateOneDataInverseRelationActionKinds.join(
                  ', ',
                )}`,
              );
            }

            const relatedResource = inverseRelation.getTo();
            const selectionNode = relatedResource
              .getIdentifier()
              .getSelectionNode(TypeKind.Input);

            // First we delete & disconnect in order to avoid further unique constraint errors
            await Promise.all(
              [
                UpdateOneDataInverseRelationActionKind.Delete,
                UpdateOneDataInverseRelationActionKind.Disconnect,
              ].map(async (actionKind) => {
                const actionValues = actions[actionKind];
                if (typeof actionValues !== 'undefined') {
                  if (actionValues == null) {
                    throw new Error(
                      `The "${inverseRelation}" relation's action "${actionKind}" does not support an empty value`,
                    );
                  }

                  await Promise.all(
                    (inverseRelation.isToMany()
                      ? actionValues
                      : [actionValues]
                    ).map(async (actionValue: any) => {
                      switch (actionKind) {
                        case UpdateOneDataInverseRelationActionKind.Delete: {
                          const where = relatedResource
                            .getInputType('WhereUnique')
                            .assert({
                              ...actionValue,
                              [inverseRelation.getInverse().name]: id,
                            });

                          await relatedResource
                            .getMutation('DeleteOne')
                            .resolve({
                              args: { where },
                              context,
                              selectionNode,
                            });
                          break;
                        }

                        case UpdateOneDataInverseRelationActionKind.Disconnect: {
                          const where = relatedResource
                            .getInputType('WhereUnique')
                            .assert({
                              ...actionValue,
                              [inverseRelation.getInverse().name]: id,
                            });

                          const updatedNode = await relatedResource
                            .getMutation('UpdateOne')
                            .resolve({
                              args: {
                                where,
                                data: {
                                  [inverseRelation.getInverse().name]: {
                                    [UpdateOneDataRelationActionKind.Disconnect]: true,
                                  },
                                },
                              },
                              context,
                              selectionNode,
                            });

                          if (!updatedNode) {
                            throw new NodeNotFoundError(
                              relatedResource.getMutation('UpdateOne'),
                              where,
                            );
                          }
                          break;
                        }

                        default:
                          throw new Error(
                            `The "${inverseRelation}" relation's action "${actionKind}" is not supported, yet`,
                          );
                      }
                    }),
                  );
                }
              }),
            );

            // Then we do everything else
            await Promise.all(
              updateOneDataInverseRelationActionKinds.map(
                async (actionKind) => {
                  const actionValues = actions[actionKind];
                  if (typeof actionValues !== 'undefined') {
                    if (actionValues == null) {
                      throw new Error(
                        `The "${inverseRelation}" relation's action "${actionKind}" does not support an empty value`,
                      );
                    }

                    await Promise.all(
                      (inverseRelation.isToMany()
                        ? actionValues
                        : [actionValues]
                      ).map(async (actionValue: any) => {
                        switch (actionKind) {
                          case UpdateOneDataInverseRelationActionKind.Connect: {
                            const where = relatedResource
                              .getInputType('WhereUnique')
                              .assert(actionValue);

                            const updatedNode = await relatedResource
                              .getMutation('UpdateOne')
                              .resolve({
                                args: {
                                  where,
                                  data: {
                                    [inverseRelation.getInverse().name]: {
                                      [UpdateOneDataRelationActionKind.Connect]: id,
                                    },
                                  },
                                },
                                context,
                                selectionNode,
                              });

                            if (!updatedNode) {
                              throw new NodeNotFoundError(
                                relatedResource.getMutation('UpdateOne'),
                                where,
                              );
                            }
                            break;
                          }

                          case UpdateOneDataInverseRelationActionKind.Create: {
                            await relatedResource
                              .getMutation('CreateOne')
                              .resolve({
                                args: {
                                  data: {
                                    ...actionValue,
                                    [inverseRelation.getInverse().name]: {
                                      [CreateOneDataRelationActionKind.Connect]: id,
                                    },
                                  },
                                },
                                context,
                                selectionNode,
                              });
                            break;
                          }

                          case UpdateOneDataInverseRelationActionKind.Delete: {
                            // Already done
                            break;
                          }

                          case UpdateOneDataInverseRelationActionKind.Disconnect: {
                            // Already done
                            break;
                          }

                          case UpdateOneDataInverseRelationActionKind.Update: {
                            const where = relatedResource
                              .getInputType('WhereUnique')
                              .assert({
                                [inverseRelation.getInverse().name]: id,
                                ...actionValue.where,
                              });

                            const updatedNode = await relatedResource
                              .getMutation('UpdateOne')
                              .resolve({
                                args: {
                                  where,
                                  data: {
                                    ...actionValue.data,
                                    ...(inverseRelation.getInverse().isMutable()
                                      ? {
                                          [inverseRelation.getInverse().name]: {
                                            [UpdateOneDataRelationActionKind.Connect]: id,
                                          },
                                        }
                                      : {}),
                                  },
                                },
                                context,
                                selectionNode,
                              });

                            if (!updatedNode) {
                              throw new NodeNotFoundError(
                                relatedResource.getMutation('UpdateOne'),
                                where,
                              );
                            }
                            break;
                          }

                          case UpdateOneDataInverseRelationActionKind.Upsert: {
                            const where = relatedResource
                              .getInputType('WhereUnique')
                              .assert({
                                [inverseRelation.getInverse().name]: id,
                                ...actionValue.where,
                              });

                            await relatedResource
                              .getMutation('UpsertOne')
                              .resolve({
                                args: {
                                  where,
                                  update: {
                                    ...actionValue.update,
                                    ...(inverseRelation.getInverse().isMutable()
                                      ? {
                                          [inverseRelation.getInverse().name]: {
                                            [UpdateOneDataRelationActionKind.Connect]: id,
                                          },
                                        }
                                      : {}),
                                  },
                                  create: {
                                    ...actionValue.create,
                                    [inverseRelation.getInverse().name]: {
                                      [CreateOneDataRelationActionKind.Connect]: id,
                                    },
                                  },
                                },
                                context,
                                selectionNode,
                              });
                            break;
                          }

                          default:
                            throw new Error(
                              `The "${inverseRelation}" relation's action "${actionKind}" is not supported, yet`,
                            );
                        }
                      }),
                    );
                  }
                },
              ),
            );
          }
        },
      ),
    );
  }

  public async preUpdate({
    args,
    context,
  }: {
    args: UpdateOneOperationArgs;
    context: AnyBaseContext;
  }): Promise<ConnectorUpdateOperationArgs> {
    const resource = this.resource;

    const filter = await resource.filter(context);
    const nodeId = resource.getInputType('WhereUnique').assert(args.where);
    const where: WhereInputValue = { AND: [filter, nodeId] };

    const update = new UpdateOneValue(
      resource,
      await this.parseDataComponentMap(args.data, context),
    );

    if (resource.hasPreHook(ResourceHookKind.PreUpdate)) {
      const selectionNode = this.resource
        .getComponentSet()
        .getSelectionNode(TypeKind.Input);

      const toBeUpdatedNodeData = await this.connector.find({
        args: { first: 1, selectionNode, where: nodeId },
        context,
        resource,
      });
      const toBeUpdatedNode = toBeUpdatedNodeData[0];

      // Let's the value be manipulated easily AND safely in the hooks
      const { proxy, revoke } = update.toProxy();

      // Apply the components' hooks
      await Promise.all([
        // Fields
        ...[...resource.getFieldSet()].map(async (field) => {
          const { proxy: hookData, revoke } = Proxy.revocable(
            {
              metas: Object.freeze({
                args,
                context,
                resource,
                field,
                toBeUpdatedNodeId: nodeId,
                toBeUpdatedNode,
                update: proxy,
              }),
              fieldValue: update.get(field),
            },
            {
              // Let's the value be manipulated easily AND safely in the hooks
              set: (hookData, propertyKey, value, receiver) =>
                propertyKey === 'fieldValue'
                  ? update.set(field, value)
                  : Reflect.set(hookData, propertyKey, value, receiver),
            },
          );

          await field.emitSerial(ResourceHookKind.PreUpdate, hookData);

          // Forbids any further changes
          revoke();
        }),
        // Relations
        ...[...resource.getRelationSet()].map(async (relation) => {
          const { proxy: hookData, revoke } = Proxy.revocable(
            {
              metas: Object.freeze({
                args,
                context,
                resource,
                relation,
                toBeUpdatedNodeId: nodeId,
                toBeUpdatedNode,
                update: proxy,
              }),
              relatedNodeId: update.get(relation),
            },
            {
              // Let's the value be manipulated easily AND safely in the hooks
              set: (hookData, propertyKey, value, receiver) =>
                propertyKey === 'relatedNodeId'
                  ? update.set(relation, value)
                  : Reflect.set(hookData, propertyKey, value, receiver),
            },
          );

          await relation.emitSerial(ResourceHookKind.PreUpdate, hookData);

          // Forbids any further changes
          revoke();
        }),
      ]);

      // Apply the resources' hooks
      await resource.emitSerial(ResourceHookKind.PreUpdate, {
        metas: Object.freeze({
          args,
          context,
          resource,
          toBeUpdatedNodeId: nodeId,
          toBeUpdatedNode,
        }),
        // @deprecated: use one in metas
        toBeUpdatedNodeId: nodeId,
        update: proxy,
      });

      // Forbids any further changes
      revoke();
    }

    return { where, data: update };
  }

  public async resolve(
    params: OperationResolverParams<UpdateOneOperationArgs>,
  ): Promise<UpdateOneOperationResult> {
    const { args, context, selectionNode } = params;
    const resource = this.resource;

    // Build the connector args
    const { where, data: update } = await this.preUpdate({ args, context });

    // Actually update the node
    const { matchedCount, changedCount } = update.isEmpty()
      ? {
          matchedCount: await this.connector.count(
            Object.freeze({
              resource,
              context,
              args: { where },
            }),
          ),
          changedCount: 0,
        }
      : await this.connector.update(
          Object.freeze({
            resource,
            context,
            args: { where, data: update },
          }),
        );

    // If no row matched, we can stop here
    if (matchedCount === 0) {
      return null;
    }

    const nodeId = resource.getInputType('WhereUnique').assert(args.where);

    await this.parseDataInverseRelationMap(args.data, nodeId, context);

    // Select all the components in case of post success hooks
    selectionNode.setChildren(
      resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input),
    );

    // Always fetch the updated node
    const node = await resource
      .getQuery('AssertOne')
      .resolve({ ...params, args: { where: nodeId } });

    if (changedCount === 1) {
      await resource.emitSerial(ResourceHookKind.ToBeUpdated, {
        metas: Object.freeze({
          ...params,
          resource,
        }),
        toBeUpdatedNode: resource.serializeValue(
          node as NodeValue,
          true,
          resource.getComponentSet(),
        ),
      });

      if (context.operationContext.type === GraphQLOperationType.Mutation) {
        context.operationContext.postSuccessHooks?.push(
          resource.emit.bind(resource, ResourceHookKind.PostUpdate, {
            metas: Object.freeze({
              ...params,
              resource,
            }),
            updatedNode: resource.serializeValue(
              node as NodeValue,
              true,
              resource.getComponentSet(),
            ),
          }),
        );
      }
    }

    return node;
  }
}
