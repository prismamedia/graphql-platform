import {
  addPath,
  isPlainObject,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { IConnector } from '../../connector';
import { INodeValue, TWhereUniqueNodeValue } from '../../node';
import { mergeSelections } from '../../node/selection';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { NodeNotFoundError } from '../errors';
import { AbstractMutation, IMutationConfig } from './abstract-mutation';

export interface IUpdateOperationArgs extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueNodeValue;
}

export type TUpdateOperationResult = INodeValue;

export interface IUpdateOperationConfig extends IMutationConfig {}

export class UpdateOperation extends AbstractMutation<
  IUpdateOperationConfig,
  IUpdateOperationArgs,
  TUpdateOperationResult
> {
  public readonly name = `update${this.node}`;
  public readonly description = `Updates one "${this.node}" node then returns it or throws an Error if it does not exist`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IUpdateOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TUpdateOperationResult> {
    if (!isPlainObject(args)) {
      throw new UnexpectedValueError(args, `an object`, path);
    }

    const [filter, selections] = await Promise.all([
      this.node.getContextualizedFilter(
        this.node.whereUniqueInput.assertValue(
          args.where,
          addPath(path, 'where'),
        ),
        operationContext.context,
        path,
      ),
      this.node.getContextualizedSelections(
        // In case some "updated" listeners are registered, we ensure we'll be able to provide them the whole node
        this.node.listenerCount('updated')
          ? mergeSelections(...args.selections, ...this.node.selections)
          : args.selections,
        operationContext.context,
        path,
      ),
    ]);

    const [nodeValue = null] =
      filter.kind === 'Boolean' && !filter.value
        ? // In case of a "false" filter, we can save a connector call
          []
        : await operationContext.connector.update(
            this.node,
            {
              filter,
              data: {},
              first: 1,
              selections,
            },
            operationContext,
          );

    if (!nodeValue) {
      throw new NodeNotFoundError(this.node, args.where, path);
    }

    if (this.node.listenerCount('updated')) {
      operationContext.postSuccessEvents.push(
        this.node.emit.bind(this.node, 'updated', {
          node: this.node,
          // We provide the whole node to the listeners
          value: this.node.assertNodeValue(
            nodeValue,
            this.node.selections,
            path,
          ),
          context: operationContext.context,
        }),
      );
    }

    // Even if we have selected some extra fields for the listeners, we return only what the client selected
    return this.node.assertNodeValue(nodeValue, args.selections, path);
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IUpdateOperationArgs> {
    return {
      where: {
        type: GraphQLNonNull(this.node.whereUniqueInput.type),
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(this.node.type);
  }
}
