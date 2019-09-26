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

export interface IUpdateIfExistsOperationArgs
  extends ISelectionsAwareOperationArgs {
  where: TWhereUniqueInputValue;
}

export type TUpdateIfExistsOperationResult = INodeValue | null;

export interface IUpdateIfExistsOperationConfig extends IMutationConfig {}

export class UpdateIfExistsOperation extends AbstractMutation<
  IUpdateIfExistsOperationArgs,
  TUpdateIfExistsOperationResult,
  IUpdateIfExistsOperationConfig
> {
  public readonly name = `update${this.node.name}IfExists`;
  public readonly description = `Deletes one "${this.node.name}" node then returns it or null if it does not exist`;

  public constructor(node: Node, config?: IUpdateIfExistsOperationConfig) {
    super(node, { public: false, ...config });
  }

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IUpdateIfExistsOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TUpdateIfExistsOperationResult> {
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

    if (nodeValue) {
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

      // Event if we have selected some extra fields for the listeners, we return only what the client selected
      return this.node.assertNodeValue(nodeValue, args.selections, path);
    }

    return null;
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IUpdateIfExistsOperationArgs> {
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
