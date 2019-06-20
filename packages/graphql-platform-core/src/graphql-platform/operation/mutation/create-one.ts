import { cleanOwnObject, isPlainObject } from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { ConnectorCreateInputValue } from '../../connector';
import { OperationResolverParams } from '../../operation';
import { ResourceHookKind } from '../../resource';
import { FieldHookMap, RelationHookMap } from '../../resource/component';
import { CreateInputValue, NodeSource, TypeKind } from '../../type';
import { AbstractOperation } from '../abstract-operation';
import { UpdateOneOperationArgs } from './update-one';

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
    const { args, context, operationContext, selectionNode } = params;
    const resource = this.resource;

    const data = typeof args.data === 'boolean' ? {} : args.data;
    const create: ConnectorCreateInputValue = {};

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
            : null);

          relation.setValue(
            create,
            relatedNodeId
              ? relation
                  .getTo()
                  .getInputType('WhereUnique')
                  .assertUnique(relatedNodeId, relation.getToUnique(), true)
              : null,
          );
        }
      }),
    ]);

    // Apply the components' hooks
    await Promise.all([
      // Fields
      ...[...resource.getFieldSet()].map(async field => {
        const hookData: FieldHookMap[ResourceHookKind.PreCreate] = {
          metas: Object.freeze({
            args,
            context,
            operationContext,
            resource,
            field,
            create,
          }),
          fieldValue: field.parseValue(create[field.name]),
        };

        await field.emitSerial(ResourceHookKind.PreCreate, hookData);

        field.setValue(create, hookData.fieldValue);
      }),

      // Relations
      ...[...resource.getRelationSet()].map(async relation => {
        const hookData: RelationHookMap[ResourceHookKind.PreCreate] = {
          metas: Object.freeze({
            args,
            context,
            operationContext,
            resource,
            relation,
            create,
          }),
          relatedNodeId: relation.parseValue(create[relation.name]),
        };

        await relation.emitSerial(ResourceHookKind.PreCreate, hookData);

        relation.setValue(create, hookData.relatedNodeId);
      }),
    ]);

    // Apply the resources' hooks
    await resource.emitSerial(ResourceHookKind.PreCreate, {
      metas: Object.freeze({
        args,
        context,
        operationContext,
        resource,
      }),
      create,
    });

    // Remove "undefined" values
    cleanOwnObject(create);

    // Actually create the node
    const [nodeSource] = await this.connector.create({ ...params, resource, args: { ...args, data: [create] } });
    const nodeId = resource.getInputType('WhereUnique').assert(nodeSource);

    if (operationContext) {
      operationContext.postHooks.push(
        resource.emitSerial.bind(resource, ResourceHookKind.PostCreate, {
          metas: Object.freeze({
            args,
            context,
            operationContext,
            resource,
            create,
          }),
          createdNodeId: nodeId,
        }),
      );
    }

    return selectionNode.hasDiff(nodeSource)
      ? resource.getQuery('AssertOne').resolve({ ...params, args: { where: nodeId } })
      : nodeSource;
  }
}
