import {
  Entries,
  fromEntries,
  getEnumValues,
  getPlainObjectEntries,
  GraphQLListDecorator,
  GraphQLNonNullDecorator,
  GraphQLOperationType,
  isPlainObject,
  POJO,
} from '@prismamedia/graphql-platform-utils';
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
import { Memoize } from 'typescript-memoize';
import { BaseContext } from '../../../graphql-platform';
import { ConnectorCreateOperationArgs } from '../../connector';
import { OperationResolverParams } from '../../operation';
import {
  ComponentValue,
  Field,
  FieldValue,
  InverseRelation,
  NodeValue,
  Relation,
  RelationValue,
  ResourceHookKind,
} from '../../resource';
import { NodeSource, TypeKind } from '../../type';
import { WhereUniqueInputValue } from '../../type/input';
import { AbstractOperation } from '../abstract-operation';
import { NodeNotFoundError } from '../error';
import { CreateOneRawValue, CreateOneValue } from './create-one/value';
import { UpdateOneDataRelationActionKind } from './update-one';

export * from './create-one/value';

export enum CreateOneDataRelationActionKind {
  Connect = 'connect',
  Create = 'create',
  Update = 'update',
  Upsert = 'upsert',
}

export const createOneDataRelationActionKinds = getEnumValues(CreateOneDataRelationActionKind);

export enum CreateOneDataInverseRelationActionKind {
  Connect = 'connect',
  Create = 'create',
}

export const createOneDataInverseRelationActionKinds = getEnumValues(CreateOneDataInverseRelationActionKind);

export type CreateOneDataInputValue = POJO;

export type CreateOneOperationArgs = {
  data: CreateOneDataInputValue;
};

export type CreateOneOperationResult = NodeSource;

export class CreateOneOperation extends AbstractOperation<CreateOneOperationArgs, CreateOneOperationResult> {
  @Memoize()
  public get name(): string {
    return `create${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Create a single "${this.resource}" node.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
  }

  @Memoize(({ name }: Field) => name)
  protected getDataFieldConfig(field: Field): GraphQLInputFieldConfig | undefined {
    if (!field.isFullyManaged()) {
      return {
        description: field.description,
        type: GraphQLNonNullDecorator(field.getType(), field.isRequired()),
      };
    }
  }

  @Memoize(({ name }: Relation) => name)
  protected getDataRelationConfig(relation: Relation): GraphQLInputFieldConfig | undefined {
    const resource = relation.getFrom();
    const relatedResource = relation.getTo();

    if (!relation.isFullyManaged()) {
      return {
        description: [`Actions for the "${relation}" relation`, relation.description].filter(Boolean).join(': '),
        type: GraphQLNonNullDecorator(
          new GraphQLInputObjectType({
            name: [resource.name, 'Nested', relation.pascalCasedName, 'CreateInput'].join(''),
            fields: () => {
              const fields: GraphQLInputFieldConfigMap = {};

              fields[CreateOneDataRelationActionKind.Connect] = {
                description: `Connect an existing "${relatedResource}" node to the new "${resource}" node, through the "${relation}" relation.`,
                type: relatedResource.getInputType('WhereUnique').getGraphQLType(),
              };

              if (relatedResource.getMutation('UpdateOne').isPublic()) {
                fields[CreateOneDataRelationActionKind.Update] = {
                  description: `Update an existing "${relatedResource}" node and connect it to the new "${resource}" node, through the "${relation}" relation.`,
                  type: new GraphQLInputObjectType({
                    name: [resource.name, 'NestedUpdate', relation.pascalCasedName, 'CreateInput'].join(''),
                    fields: () => relatedResource.getMutation('UpdateOne').getGraphQLFieldConfigArgs(),
                  }),
                };
              }

              if (relatedResource.getMutation('CreateOne').isPublic()) {
                fields[CreateOneDataRelationActionKind.Create] = {
                  description: `Create a new "${relatedResource}" node and connect it to the new "${resource}" node, through the "${relation}" relation.`,
                  type: relatedResource.getMutation('CreateOne').getDataType(),
                };
              }

              if (relatedResource.getMutation('UpsertOne').isPublic()) {
                fields[CreateOneDataRelationActionKind.Upsert] = {
                  description: `Create or update a "${relatedResource}" node and connect it to the new "${resource}" node, through the "${relation}" relation.`,
                  type: new GraphQLInputObjectType({
                    name: [resource.name, 'NestedUpsert', relation.pascalCasedName, 'CreateInput'].join(''),
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
  }

  @Memoize(({ name }: InverseRelation) => name)
  protected getDataInverseRelationConfig(relation: InverseRelation): GraphQLInputFieldConfig | undefined {
    const resource = relation.getFrom();
    const relatedResource = relation.getTo();

    if (
      (relatedResource.getMutation('UpdateOne').isPublic() && relation.getInverse().isMutable()) ||
      relatedResource.getMutation('CreateOne').isPublic()
    ) {
      return {
        description: [`Actions for the "${relation}" relation`, relation.description].filter(Boolean).join(': '),
        type: new GraphQLInputObjectType({
          name: [resource.name, 'Nested', relation.pascalCasedName, 'CreateInput'].join(''),
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            if (relatedResource.getMutation('UpdateOne').isPublic() && relation.getInverse().isMutable()) {
              fields[CreateOneDataInverseRelationActionKind.Connect] = {
                description: relation.isToMany()
                  ? `Connect existing "${relatedResource}" nodes to the new "${resource}" node, through the "${relation}" relation.`
                  : `Connect an existing "${relatedResource}" node to the new "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getInputType('WhereUnique').getGraphQLType(),
                    relation.isToMany(),
                  ),
                  relation.isToMany(),
                ),
              };
            }

            if (relatedResource.getMutation('CreateOne').isPublic()) {
              fields[CreateOneDataInverseRelationActionKind.Create] = {
                description: relation.isToMany()
                  ? `Create new "${relatedResource}" nodes and connect them to the new "${resource}" node, through the "${relation}" relation.`
                  : `Create a new "${relatedResource}" node and connect it to the new "${resource}" node, through the "${relation}" relation.`,
                type: GraphQLListDecorator(
                  GraphQLNonNullDecorator(
                    relatedResource.getMutation('CreateOne').getDataType(relation.getInverse()),
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

  @Memoize((forcedRelation?: Relation) => (forcedRelation ? forcedRelation.name : ''))
  public getDataType(forcedRelation?: Relation): GraphQLInputObjectType | GraphQLScalarType {
    forcedRelation && this.resource.assertComponent(forcedRelation);

    const fields: GraphQLInputFieldConfigMap = fromEntries([
      // Fields
      ...[...this.resource.getFieldSet()].map(field => [field.name, this.getDataFieldConfig(field)]),
      // Relations
      ...[...this.resource.getRelationSet()].map(relation => [
        relation.name,
        forcedRelation && forcedRelation === relation ? undefined : this.getDataRelationConfig(relation),
      ]),
      // Inverse relations
      ...[...this.resource.getInverseRelationSet()].map(relation => [
        relation.name,
        this.getDataInverseRelationConfig(relation),
      ]),
    ] as Entries<GraphQLInputFieldConfigMap>);

    return Object.keys(fields).length > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            forcedRelation ? `WithForced${forcedRelation.pascalCasedName}` : null,
            'CreateInput',
          ].join(''),
          fields,
        })
      : GraphQLBoolean;
  }

  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      data: {
        type: GraphQLNonNull(this.getDataType()),
      },
    };
  }

  protected async parseDataComponentMap(
    data: CreateOneDataInputValue,
    context: BaseContext,
  ): Promise<CreateOneRawValue> {
    return fromEntries(
      await Promise.all([
        // Fields
        ...[...this.resource.getFieldSet()].map(
          async (field): Promise<[string, FieldValue | undefined]> => [field.name, data[field.name]],
        ),
        // Relations
        ...[...this.resource.getRelationSet()].map(
          async (relation): Promise<[string, RelationValue] | undefined> => {
            const actions = data[relation.name];
            if (actions != null) {
              if (
                !(
                  isPlainObject(actions) &&
                  Object.keys(actions).length === 1 &&
                  createOneDataRelationActionKinds.includes(Object.keys(actions)[0] as any)
                )
              ) {
                throw new Error(
                  `The "${relation}" relation supports exactly 1 action among: ${createOneDataRelationActionKinds.join(
                    ', ',
                  )}`,
                );
              }

              const actionKind = Object.keys(actions)[0] as CreateOneDataRelationActionKind;
              const actionValue = actions[actionKind];

              if (actionValue == null) {
                throw new Error(`The "${relation}" relation's action "${actionKind}" does not support an empty value`);
              }

              // Returns only the selection we need (the targeted unique constraint)
              const selectionNode = relation.getToUnique().getSelectionNode(TypeKind.Input);
              const relatedResource = relation.getTo();

              let relatedNode: NodeSource;
              switch (actionKind) {
                case CreateOneDataRelationActionKind.Connect: {
                  relatedNode = await relatedResource
                    .getQuery('AssertOne')
                    .resolve({ args: { where: actionValue }, context, selectionNode });
                  break;
                }

                case CreateOneDataRelationActionKind.Update: {
                  const updatedNode = await relatedResource
                    .getMutation('UpdateOne')
                    .resolve({ args: actionValue, context, selectionNode });

                  if (!updatedNode) {
                    throw new NodeNotFoundError(relatedResource.getMutation('UpdateOne'), actionValue.where);
                  }

                  relatedNode = updatedNode;
                  break;
                }

                case CreateOneDataRelationActionKind.Create: {
                  relatedNode = await relatedResource
                    .getMutation('CreateOne')
                    .resolve({ args: { data: actionValue }, context, selectionNode });
                  break;
                }

                case CreateOneDataRelationActionKind.Upsert: {
                  relatedNode = await relatedResource
                    .getMutation('UpsertOne')
                    .resolve({ args: actionValue, context, selectionNode });
                  break;
                }

                default:
                  throw new Error(`The "${relation}" relation's action "${actionKind}" is not supported, yet`);
              }

              return [relation.name, relatedNode as RelationValue];
            }
          },
        ),
      ] as Promise<[string, ComponentValue | undefined] | undefined>[]),
    );
  }

  protected async parseDataInverseRelationMap(
    data: CreateOneDataInputValue,
    id: WhereUniqueInputValue,
    context: BaseContext,
  ): Promise<void> {
    await Promise.all(
      [...this.resource.getInverseRelationSet()].map(async inverseRelation => {
        const actions = data[inverseRelation.name];
        if (actions != null) {
          if (
            !(
              isPlainObject(actions) &&
              Object.keys(actions).length > 0 &&
              Object.keys(actions).every(actionKind =>
                createOneDataInverseRelationActionKinds.includes(actionKind as any),
              )
            )
          ) {
            throw new Error(
              `The "${inverseRelation}" relation supports at least one action among: ${createOneDataInverseRelationActionKinds.join(
                ', ',
              )}`,
            );
          }

          const relatedResource = inverseRelation.getTo();
          const selectionNode = relatedResource.getIdentifier().getSelectionNode(TypeKind.Input);

          await Promise.all(
            getPlainObjectEntries(actions as Record<CreateOneDataInverseRelationActionKind, any>).map(
              async ([actionKind, actionValues]) => {
                if (actionValues == null) {
                  throw new Error(
                    `The "${inverseRelation}" relation's action "${actionKind}" does not support an empty value`,
                  );
                }

                await Promise.all(
                  (inverseRelation.isToMany() ? actionValues : [actionValues]).map(async (actionValue: any) => {
                    switch (actionKind) {
                      case CreateOneDataInverseRelationActionKind.Connect:
                        const where = relatedResource.getInputType('WhereUnique').assert(actionValue);

                        const updatedNode = await relatedResource.getMutation('UpdateOne').resolve({
                          args: {
                            where,
                            data: {
                              [inverseRelation.getInverse().name]: { [UpdateOneDataRelationActionKind.Connect]: id },
                            },
                          },
                          context,
                          selectionNode,
                        });

                        if (!updatedNode) {
                          throw new NodeNotFoundError(relatedResource.getMutation('UpdateOne'), where);
                        }
                        break;

                      case CreateOneDataInverseRelationActionKind.Create:
                        await relatedResource.getMutation('CreateOne').resolve({
                          args: {
                            data: {
                              ...actionValue,
                              [inverseRelation.getInverse().name]: { [CreateOneDataRelationActionKind.Connect]: id },
                            },
                          },
                          context,
                          selectionNode,
                        });
                        break;

                      default:
                        throw new Error(
                          `The "${inverseRelation}" relation's action "${actionKind}" is not supported, yet`,
                        );
                    }
                  }),
                );
              },
            ),
          );
        }
      }),
    );
  }

  public async preCreate(
    params: OperationResolverParams<CreateOneOperationArgs>,
  ): Promise<ConnectorCreateOperationArgs> {
    const { args, context } = params;
    const resource = this.resource;

    const create = new CreateOneValue(resource, await this.parseDataComponentMap(args.data, context));

    if (resource.hasPreHook(ResourceHookKind.PreCreate)) {
      // Let's the value be manipulated easily AND safely in the hooks
      const { proxy, revoke } = create.toProxy();

      // Apply the components' hooks
      await Promise.all([
        // Fields
        ...[...resource.getFieldSet()].map(async field => {
          const { proxy: hookData, revoke } = Proxy.revocable(
            {
              metas: Object.freeze({
                ...params,
                resource,
                field,
                create: proxy,
              }),
              fieldValue: create.get(field),
            },
            {
              // Let's the value be manipulated easily AND safely in the hooks
              set: (hookData, propertyKey, value, receiver) =>
                propertyKey === 'fieldValue'
                  ? create.set(field, value)
                  : Reflect.set(hookData, propertyKey, value, receiver),
            },
          );

          await field.emitSerial(ResourceHookKind.PreCreate, hookData);

          // Forbids any further changes
          revoke();
        }),
        // Relations
        ...[...resource.getRelationSet()].map(async relation => {
          const { proxy: hookData, revoke } = Proxy.revocable(
            {
              metas: Object.freeze({
                ...params,
                resource,
                relation,
                create: proxy,
              }),
              relatedNodeId: create.get(relation),
            },
            {
              // Let's the value be manipulated easily AND safely in the hooks
              set: (hookData, propertyKey, value, receiver) =>
                propertyKey === 'relatedNodeId'
                  ? create.set(relation, value)
                  : Reflect.set(hookData, propertyKey, value, receiver),
            },
          );

          await relation.emitSerial(ResourceHookKind.PreCreate, hookData);

          // Forbids any further changes
          revoke();
        }),
      ]);

      // Apply the resources' hooks
      await resource.emitSerial(ResourceHookKind.PreCreate, {
        metas: Object.freeze({
          ...params,
          resource,
        }),
        create: proxy,
      });

      // Forbids any further changes
      revoke();
    }

    return { data: [create] };
  }

  public async resolve(params: OperationResolverParams<CreateOneOperationArgs>): Promise<CreateOneOperationResult> {
    const { args, context, selectionNode } = params;
    const resource = this.resource;

    // Build the connector args
    const {
      data: [create],
    } = await this.preCreate(params);

    // Actually create the node
    await this.connector.create(Object.freeze({ resource, context, args: { data: [create] } }));

    const nodeFromCreate = create.toNodeValue();
    const nodeId = resource.getInputType('WhereUnique').assertUnique(nodeFromCreate, resource.getIdentifier(), true);

    await this.parseDataInverseRelationMap(args.data, nodeId, context);

    // Select all the components in case of post success hooks
    const hasPostSuccessHook = resource.hasPostHook(ResourceHookKind.PostCreate);
    if (hasPostSuccessHook) {
      selectionNode.setChildren(resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input));
    }

    const node = selectionNode.hasDiff(nodeFromCreate)
      ? await resource.getQuery('AssertOne').resolve({
          ...params,
          args: {
            where: nodeId,
          },
        })
      : (nodeFromCreate as NodeSource);

    const { operationContext } = context;
    const postSuccessHooks =
      operationContext.type === GraphQLOperationType.Mutation ? operationContext.postSuccessHooks : undefined;

    if (postSuccessHooks && hasPostSuccessHook) {
      postSuccessHooks.push(
        resource.emit.bind(resource, ResourceHookKind.PostCreate, {
          metas: Object.freeze({
            ...params,
            resource,
          }),
          createdNode: resource.serializeValue(node as NodeValue, true, resource.getComponentSet()),
        }),
      );
    }

    return node;
  }
}
