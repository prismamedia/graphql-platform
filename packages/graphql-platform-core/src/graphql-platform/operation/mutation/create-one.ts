import { cleanOwnObject, GraphQLOperationType, isPlainObject } from '@prismamedia/graphql-platform-utils';
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
    const { args, context, selectionNode } = params;
    const operationContext = context.operationContext;
    const resource = this.resource;

    const postSuccessHooks =
      operationContext.type === GraphQLOperationType.Mutation ? operationContext.postSuccessHooks : undefined;

    const data = typeof args.data === 'boolean' ? {} : args.data;
    const create: ConnectorCreateInputValue = Object.create(null);

    // Select all the components in case of post success hooks
    const hasPostSuccessHook = resource.getEventListenerCount(ResourceHookKind.PostCreate) > 0;
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
            : null);

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
