import { cleanOwnObject, GraphQLOperationType, isPlainObject } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigArgumentMap, GraphQLInputObjectType, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { ConnectorUpdateInputValue } from '../../connector';
import { OperationResolverParams } from '../../operation';
import { ResourceHookKind } from '../../resource';
import { FieldHookMap, RelationHookMap } from '../../resource/component';
import { NodeSource, TypeKind, UpdateInputValue, WhereUniqueInputValue } from '../../type';
import { WhereInputValue } from '../../type/input';
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
  public getGraphQLFieldConfigArgsAsType(): GraphQLInputObjectType {
    return new GraphQLInputObjectType({
      name: [this.resource.name, 'UpdateOneInput'].join(''),
      fields: () => this.getGraphQLFieldConfigArgs(),
    });
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

    // Select all the components in case of post success hooks
    const hasPostSuccessHook = resource.getEventListenerCount(ResourceHookKind.PostUpdate) > 0;
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
          const relatedResource = relation.getTo();

          // Returns only the selection we need (the targeted unique constraint)
          const selectionNode = relation.getToUnique().getSelectionNode(TypeKind.Input);

          const relatedNode = await (isPlainObject(actions['connect'])
            ? relatedResource
                .getQuery('AssertOne')
                .resolve({ ...params, args: { where: actions['connect'] }, selectionNode })
            : isPlainObject(actions['create'])
            ? relatedResource
                .getMutation('CreateOne')
                .resolve({ ...params, args: { data: actions['create'] }, selectionNode })
            : isPlainObject(actions['update'])
            ? relatedResource
                .getMutation('UpdateOne')
                .resolve({ ...params, args: actions['update'] as UpdateOneOperationArgs, selectionNode })
            : actions['disconnect'] === true
            ? null
            : undefined);

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
    const { matchedCount, changedCount } = await this.connector.update(
      Object.freeze({
        ...params,
        resource,
        args: { ...args, where, data: update },
      }),
    );

    if (matchedCount === 1) {
      const node = await resource.getQuery('AssertOne').resolve({ ...params, args: { where: nodeId } });

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

    return null;
  }
}
