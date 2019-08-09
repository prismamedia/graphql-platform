import { cleanOwnObject, GraphQLOperationType, isPlainObject } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { ConnectorCreateInputValue } from '../../connector';
import { OperationResolverParams } from '../../operation';
import { ResourceHookKind } from '../../resource';
import { FieldHookMap, RelationHookMap } from '../../resource/component';
import { CreateInputValue, NodeSource, TypeKind } from '../../type';
import {
  CreateInverseRelationActionKind,
  createInverseRelationActionKinds,
  CreateRelationActionKind,
  createRelationActionKinds,
  UpdateRelationActionKind,
} from '../../type/input';
import { AbstractOperation } from '../abstract-operation';

export interface CreateOneOperationArgs {
  data: CreateInputValue;
}

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

  @Memoize()
  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      data: {
        type: GraphQLNonNull(this.resource.getInputType('Create').getGraphQLType()),
      },
    };
  }

  @Memoize()
  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
  }

  public async resolve(params: OperationResolverParams<CreateOneOperationArgs>): Promise<CreateOneOperationResult> {
    const { args, context, selectionNode } = params;
    const operationContext = context.operationContext;
    const resource = this.resource;

    const postSuccessHooks =
      operationContext.type === GraphQLOperationType.Mutation ? operationContext.postSuccessHooks : undefined;

    const data = typeof args.data === 'boolean' ? {} : args.data;
    const create: ConnectorCreateInputValue = Object.create(null);

    const hasPostSuccessHook = resource.getEventListenerCount(ResourceHookKind.PostCreate) > 0;

    // Select all the components in case of post success hooks
    if (hasPostSuccessHook) {
      selectionNode.setChildren(resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input));
    }

    // Parse the provided args
    await Promise.all([
      // Fields
      ...[...resource.getFieldSet()].map(async field => {
        field.setValue(create, data[field.name]);
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

          let relatedNode = null;
          for (const actionKind of createRelationActionKinds) {
            const value = actions[actionKind];
            if (value != null) {
              switch (actionKind) {
                case CreateRelationActionKind.Connect:
                  relatedNode = await relatedResource
                    .getQuery('AssertOne')
                    .resolve({ args: { where: value }, context, selectionNode });
                  break;

                case CreateRelationActionKind.Update:
                  relatedNode = await relatedResource
                    .getMutation('UpdateOne')
                    .resolve({ args: value, context, selectionNode });
                  break;

                case CreateRelationActionKind.Create:
                  relatedNode = await relatedResource
                    .getMutation('CreateOne')
                    .resolve({ args: { data: value }, context, selectionNode });
                  break;

                case CreateRelationActionKind.Upsert:
                  relatedNode = await relatedResource
                    .getMutation('UpsertOne')
                    .resolve({ args: value, context, selectionNode });
                  break;

                default:
                  throw new Error(
                    `The relation "${relation}" does not support the following action in the "${this}" mutation: "${actionKind}"`,
                  );
              }
            }
          }

          relation.setValue(create, relatedNode ? relation.parseId(relatedNode, true, true) : null);
        }
      }),
    ]);

    // Apply the components' hooks
    await Promise.all([
      // Fields
      ...[...resource.getFieldSet()].map(async field => {
        const hookData: FieldHookMap[ResourceHookKind.PreCreate] = {
          metas: Object.freeze({
            ...params,
            resource,
            field,
            create,
          }),
          fieldValue: field.getValue(create, false),
        };

        await field.emitSerial(ResourceHookKind.PreCreate, hookData);

        field.setValue(create, field.parseValue(hookData.fieldValue, false));
      }),

      // Relations
      ...[...resource.getRelationSet()].map(async relation => {
        const hookData: RelationHookMap[ResourceHookKind.PreCreate] = {
          metas: Object.freeze({
            ...params,
            resource,
            relation,
            create,
          }),
          relatedNodeId: relation.getId(create, false),
        };

        await relation.emitSerial(ResourceHookKind.PreCreate, hookData);

        relation.setValue(create, relation.parseId(hookData.relatedNodeId, false));
      }),
    ]);

    // Apply the resources' hooks
    await resource.emitSerial(ResourceHookKind.PreCreate, {
      metas: Object.freeze({
        ...params,
        resource,
      }),
      create,
    });

    // Remove "undefined" values
    cleanOwnObject(create);

    // Actually create the node
    const [nodeSource] = await this.connector.create(
      Object.freeze({ ...params, resource, args: { ...args, data: [create] } }),
    );

    await Promise.all(
      [...resource.getInverseRelationSet()].map(async inverseRelation => {
        const actions = data[inverseRelation.name];
        if (isPlainObject(actions)) {
          const relation = inverseRelation.getInverse();
          const nodeId = relation.parseId(nodeSource, true, true);
          const relatedResource = inverseRelation.getTo();
          const selectionNode = relatedResource.getIdentifier().getSelectionNode(TypeKind.Input);

          for (const actionKind of createInverseRelationActionKinds) {
            const value = actions[actionKind];
            if (value != null) {
              await Promise.all(
                (Array.isArray(value) ? value : [value]).map(async value => {
                  switch (actionKind) {
                    case CreateInverseRelationActionKind.Connect:
                      await relatedResource.getMutation('UpdateOne').resolve({
                        args: {
                          where: value,
                          data: { [relation.name]: { [UpdateRelationActionKind.Connect]: nodeId } } as any,
                        },
                        context,
                        selectionNode,
                      });
                      break;

                    case CreateInverseRelationActionKind.Create:
                      await relatedResource.getMutation('CreateOne').resolve({
                        args: {
                          data: { ...value, [relation.name]: { [CreateRelationActionKind.Connect]: nodeId } },
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

    const node = selectionNode.hasDiff(nodeSource)
      ? await resource.getQuery('AssertOne').resolve({ ...params, args: { where: resource.parseId(nodeSource, true) } })
      : nodeSource;

    if (postSuccessHooks && hasPostSuccessHook) {
      postSuccessHooks.push(
        resource.emit.bind(resource, ResourceHookKind.PostCreate, {
          metas: Object.freeze({
            ...params,
            resource,
            create,
          }),
          createdNode: resource.parseValue(node, true, true),
        }),
      );
    }

    return node;
  }
}
