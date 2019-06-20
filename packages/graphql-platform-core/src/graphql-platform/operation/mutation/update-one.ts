import { cleanOwnObject, isPlainObject } from '@prismamedia/graphql-platform-utils';
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
    const { args, context, operationContext, selectionNode } = params;
    const resource = this.resource;

    const filter = await resource.filter(context);
    const nodeId = resource.getInputType('WhereUnique').assert(args.where);
    const where: WhereInputValue = { AND: [filter, nodeId] };

    const data = typeof args.data === 'boolean' ? {} : args.data;
    const update: ConnectorUpdateInputValue = {};

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

          const relatedNodeId = await (isPlainObject(actions['connect'])
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

          if (typeof relatedNodeId !== 'undefined') {
            relation.setValue(
              update,
              relatedNodeId
                ? relation
                    .getTo()
                    .getInputType('WhereUnique')
                    .assertUnique(relatedNodeId, relation.getToUnique(), true)
                : null,
            );
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
            args,
            context,
            operationContext,
            resource,
            field,
            update,
          }),
          fieldValue: field.parseValue(update[field.name]),
        };

        await field.emitSerial(ResourceHookKind.PreUpdate, hookData);

        field.setValue(update, hookData.fieldValue);
      }),

      // Relations
      ...[...resource.getRelationSet()].map(async relation => {
        const hookData: RelationHookMap[ResourceHookKind.PreUpdate] = {
          metas: Object.freeze({
            args,
            context,
            operationContext,
            resource,
            relation,
            update,
          }),
          relatedNodeId: relation.parseValue(update[relation.name]),
        };

        await relation.emitSerial(ResourceHookKind.PreUpdate, hookData);

        relation.setValue(update, hookData.relatedNodeId);
      }),
    ]);

    await resource.emitSerial(ResourceHookKind.PreUpdate, {
      metas: Object.freeze({
        args,
        context,
        operationContext,
        resource,
      }),
      toBeUpdatedNodeId: nodeId,
      update,
    });

    // Remove "undefined" values
    cleanOwnObject(update);

    // Actually update the node
    const { matchedCount, changedCount } = await this.connector.update({
      ...params,
      resource,
      args: { ...args, where, data: update },
    });

    if (matchedCount === 1) {
      if (operationContext && changedCount === 1) {
        operationContext.postHooks.push(
          resource.emitSerial.bind(resource, ResourceHookKind.PostUpdate, {
            metas: Object.freeze({
              args,
              context,
              operationContext,
              resource,
              update,
            }),
            updatedNodeId: nodeId,
          }),
        );
      }

      const node = resource.parseValue({ ...nodeId, ...update });

      return !node || selectionNode.hasDiff(node)
        ? resource.getQuery('AssertOne').resolve({ ...params, args: { where: nodeId } })
        : node;
    }

    return null;
  }
}
