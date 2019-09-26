import {
  addPath,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { isPlainObject } from 'lodash';
import { IConnector } from '../../connector';
import {
  INodeValue,
  mergeSelections,
  Node,
  TWhereUniqueInputValue,
} from '../../node';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { AbstractMutation, IMutationConfig } from './abstract-mutation';

export interface IDeleteIfExistsOperationArgs
  extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TDeleteIfExistsOperationResult = INodeValue | null;

export interface IDeleteIfExistsOperationConfig extends IMutationConfig {}

export class DeleteIfExistsOperation extends AbstractMutation<
  IDeleteIfExistsOperationArgs,
  TDeleteIfExistsOperationResult,
  IDeleteIfExistsOperationConfig
> {
  public readonly name = `delete${this.node.name}IfExists`;
  public readonly description = `Deletes one "${this.node.name}" node then returns it or null if it does not exist`;

  public constructor(node: Node, config?: IDeleteIfExistsOperationConfig) {
    super(node, { public: false, ...config });
  }

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IDeleteIfExistsOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TDeleteIfExistsOperationResult> {
    if (!isPlainObject(args)) {
      throw new UnexpectedValueError(args, `an object`, path);
    }

    const [filter, selections] = await Promise.all([
      this.node.getContextualizedFilter(
        this.node.whereUniqueInput.parseValue(
          args.where,
          addPath(path, 'where'),
        ),
        operationContext.context,
        path,
      ),
      this.node.getContextualizedSelections(
        // In case some "deleted" listeners are registered, we ensure we'll be able to provide them the whole node
        this.node.listenerCount('deleted')
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
        : await operationContext.connector.delete(
            this.node,
            {
              filter,
              first: 1,
              selections,
            },
            operationContext,
          );

    if (nodeValue) {
      if (this.node.listenerCount('deleted')) {
        operationContext.postSuccessEvents.push(
          this.node.emit.bind(this.node, 'deleted', {
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

      // Event if we have selected some extra fields for the listeners, we return only what the client selected
      return this.node.assertNodeValue(nodeValue, args.selections, path);
    }

    return null;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IDeleteIfExistsOperationArgs> {
    return {
      where: {
        type: GraphQLNonNull(this.node.whereUniqueInput.type),
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return this.node.type;
  }
}
