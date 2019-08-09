import { cleanOwnObject, GraphQLOperationType, isPlainObject } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { ConnectorUpdateInputValue } from '../../connector';
import { OperationResolverParams } from '../../operation';
import { ResourceHookKind } from '../../resource';
import { FieldHookMap, RelationHookMap } from '../../resource/component';
import { NodeSource, TypeKind, UpdateInputValue, WhereUniqueInputValue } from '../../type';
import {
  CreateRelationActionKind,
  UpdateInverseRelationActionKind,
  updateInverseRelationActionKinds,
  UpdateRelationActionKind,
  updateRelationActionKinds,
  WhereInputValue,
} from '../../type/input';
import { AbstractOperation } from '../abstract-operation';

export interface UpdateOneOperationArgs {
  where: WhereUniqueInputValue;
  data: UpdateInputValue;
}

export type UpdateOneOperationResult = NodeSource | null;

export class UpdateOneOperation extends AbstractOperation<UpdateOneOperationArgs, UpdateOneOperationResult> {
  @Memoize()
  public isSupported(): boolean {
    return this.resource.getComponentSet().some(component => !component.isImmutable());
  }

  @Memoize()
  public get name(): string {
    return `update${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Update a single "${this.resource}" node.`;
  }

  @Memoize()
  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      where: {
        type: GraphQLNonNull(this.resource.getInputType('WhereUnique').getGraphQLType()),
      },
      data: {
        type: GraphQLNonNull(this.resource.getInputType('Update').getGraphQLType()),
      },
    };
  }

  @Memoize()
  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return this.resource.getOutputType('Node').getGraphQLType();
  }

  public async resolve(params: OperationResolverParams<UpdateOneOperationArgs>): Promise<UpdateOneOperationResult> {
    const { args, context, selectionNode } = params;
    const operationContext = context.operationContext;
    const resource = this.resource;

    const postSuccessHooks =
      operationContext.type === GraphQLOperationType.Mutation ? operationContext.postSuccessHooks : undefined;

    const filter = await resource.filter(context);
    const nodeId = resource.parseId(args.where, true);
    const where: WhereInputValue = { AND: [filter, nodeId] };

    const data = typeof args.data === 'boolean' ? {} : args.data;
    const update: ConnectorUpdateInputValue = Object.create(null);

    const hasPostSuccessHook = resource.getEventListenerCount(ResourceHookKind.PostUpdate) > 0;

    // Select all the components in case of post success hooks
    if (hasPostSuccessHook) {
      selectionNode.setChildren(resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input));
    }

    // Parse the provided args
    await Promise.all([
      // Fields
      ...[...resource.getFieldSet()].map(async field => {
        field.setValue(update, data[field.name]);
      }),

      // Relations
      ...[...resource.getRelationSet()].map(async relation => {
        const actions = data[relation.name];
        if (isPlainObject(actions)) {
          if (Object.keys(actions).length !== 1) {
            throw new Error(`The relation "${relation}" supports exactly 1 action in the "${this}" mutation`);
          }

          const relatedResource = relation.getTo();

          // Returns only the selection we need (the targeted unique constraint)
          const selectionNode = relation.getToUnique().getSelectionNode(TypeKind.Input);

          let relatedNode = undefined;
          for (const actionKind of updateRelationActionKinds) {
            const value = actions[actionKind];
            if (value != null) {
              switch (actionKind) {
                case UpdateRelationActionKind.Connect:
                  relatedNode = await relatedResource
                    .getQuery('AssertOne')
                    .resolve({ args: { where: value }, context, selectionNode });
                  break;

                case UpdateRelationActionKind.Update:
                  relatedNode = await relatedResource
                    .getMutation('UpdateOne')
                    .resolve({ args: value, context, selectionNode });
                  break;

                case UpdateRelationActionKind.Create:
                  relatedNode = await relatedResource
                    .getMutation('CreateOne')
                    .resolve({ args: { data: value }, context, selectionNode });
                  break;

                case UpdateRelationActionKind.Upsert:
                  relatedNode = await relatedResource
                    .getMutation('UpsertOne')
                    .resolve({ args: value, context, selectionNode });
                  break;

                case UpdateRelationActionKind.Disconnect:
                  if (value === true) {
                    relatedNode = null;
                  }
                  break;

                default:
                  throw new Error(
                    `The relation "${relation}" does not support the following action in the "${this}" mutation: "${actionKind}"`,
                  );
              }
            }
          }

          if (typeof relatedNode !== 'undefined') {
            relation.setValue(update, relatedNode ? relation.parseId(relatedNode, true, true) : null);
          }
        }
      }),
    ]);

    // Apply the components' hooks
    await Promise.all([
      // Fields
      ...[...resource.getFieldSet()].map(async field => {
        const hookData: FieldHookMap[ResourceHookKind.PreUpdate] = {
          metas: Object.freeze({
            ...params,
            resource,
            field,
            update,
          }),
          fieldValue: field.getValue(update, false),
        };

        await field.emitSerial(ResourceHookKind.PreUpdate, hookData);

        field.setValue(update, field.parseValue(hookData.fieldValue, false));
      }),

      // Relations
      ...[...resource.getRelationSet()].map(async relation => {
        const hookData: RelationHookMap[ResourceHookKind.PreUpdate] = {
          metas: Object.freeze({
            ...params,
            resource,
            relation,
            update,
          }),
          relatedNodeId: relation.getId(update, false),
        };

        await relation.emitSerial(ResourceHookKind.PreUpdate, hookData);

        relation.setValue(update, relation.parseId(hookData.relatedNodeId, false));
      }),
    ]);

    await resource.emitSerial(ResourceHookKind.PreUpdate, {
      metas: Object.freeze({
        ...params,
        resource,
      }),
      toBeUpdatedNodeId: nodeId,
      update,
    });

    // Remove "undefined" values
    cleanOwnObject(update);

    // Actually update the node
    const { matchedCount, changedCount } =
      Object.keys(update).length > 0
        ? await this.connector.update(
            Object.freeze({
              ...params,
              resource,
              args: { ...args, where, data: update },
            }),
          )
        : { matchedCount: undefined, changedCount: 0 };

    // If an update actually occurred and no row matched
    if (matchedCount === 0) {
      return null;
    }

    await Promise.all(
      [...resource.getInverseRelationSet()].map(async inverseRelation => {
        const actions = data[inverseRelation.name];
        if (isPlainObject(actions)) {
          const relation = inverseRelation.getInverse();
          const relatedResource = inverseRelation.getTo();
          const selectionNode = relatedResource.getIdentifier().getSelectionNode(TypeKind.Input);

          for (const actionKind of updateInverseRelationActionKinds) {
            const value = actions[actionKind];
            if (value != null) {
              await Promise.all(
                (Array.isArray(value) ? value : [value]).map(async value => {
                  switch (actionKind) {
                    case UpdateInverseRelationActionKind.Connect:
                      await relatedResource.getMutation('UpdateOne').resolve({
                        args: {
                          where: value,
                          data: { [relation.name]: { [UpdateRelationActionKind.Connect]: nodeId } } as any,
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case UpdateInverseRelationActionKind.Update:
                      await relatedResource.getMutation('UpdateOne').resolve({
                        args: {
                          where: { [relation.name]: nodeId, ...value.where },
                          data: { ...value.data, [relation.name]: { [UpdateRelationActionKind.Connect]: nodeId } },
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case UpdateInverseRelationActionKind.Create:
                      await relatedResource.getMutation('CreateOne').resolve({
                        args: {
                          data: { ...value, [relation.name]: { [CreateRelationActionKind.Connect]: nodeId } },
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case UpdateInverseRelationActionKind.Upsert:
                      await relatedResource.getMutation('UpsertOne').resolve({
                        args: {
                          where: { [relation.name]: nodeId, ...value.where },
                          update: { ...value.update, [relation.name]: { [UpdateRelationActionKind.Connect]: nodeId } },
                          create: { ...value.create, [relation.name]: { [CreateRelationActionKind.Connect]: nodeId } },
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case UpdateInverseRelationActionKind.Disconnect:
                      await relatedResource.getMutation('UpdateOne').resolve({
                        args: {
                          where: { ...value, [relation.name]: nodeId },
                          data: { [relation.name]: { [UpdateRelationActionKind.Disconnect]: true } as any },
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case UpdateInverseRelationActionKind.Delete:
                      await relatedResource.getMutation('DeleteOne').resolve({
                        args: {
                          where: { ...value, [relation.name]: nodeId },
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    default:
                      throw new Error(
                        `The relation "${inverseRelation}" does not support the following action in the "${this}" mutation: "${actionKind}"`,
                      );
                  }
                }),
              );
            }
          }
        }
      }),
    );

    const node = await resource.getQuery('FindOne').resolve({ ...params, args: { where: nodeId } });

    if (changedCount === 1) {
      if (postSuccessHooks && hasPostSuccessHook) {
        postSuccessHooks.push(
          resource.emit.bind(resource, ResourceHookKind.PostUpdate, {
            metas: Object.freeze({
              ...params,
              resource,
              update,
            }),
            updatedNode: resource.parseValue(node, true, true),
          }),
        );
      }
    }

    return node;
  }
}
