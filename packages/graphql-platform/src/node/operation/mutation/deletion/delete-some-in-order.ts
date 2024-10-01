import * as utils from '@prismamedia/graphql-platform-utils';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../../statement.js';
import { NotFoundError } from '../../error.js';
import type { GetSomeInOrderQueryArgs } from '../../query.js';
import { AbstractDeletion } from '../abstract-deletion.js';
import type { MutationContext } from '../context.js';

export type DeleteSomeInOrderMutationArgs = GetSomeInOrderQueryArgs;

export type DeleteSomeInOrderMutationResult = NodeSelectedValue[];

export class DeleteSomeInOrderMutation<
  TRequestContext extends object,
> extends AbstractDeletion<
  TRequestContext,
  DeleteSomeInOrderMutationArgs,
  DeleteSomeInOrderMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'delete-some-in-order';
  public readonly name = `deleteSome${this.node.plural}InOrder`;
  public override readonly description = `Given a list of unique-filter's value, deletes the corresponding "${this.node.plural}" then returns their old values in the same order, throws an error if one does not exist`;

  public override get arguments() {
    return this.node.getMutationByKey('delete-some-in-order-if-exists')
      .arguments;
  }

  public getGraphQLFieldConfigType() {
    return this.node
      .getQueryByKey('get-some-in-order')
      .getGraphQLFieldConfigType();
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<DeleteSomeInOrderMutationArgs>,
    path: utils.Path,
  ): Promise<DeleteSomeInOrderMutationResult> {
    const maybeValues = await this.node
      .getMutationByKey('delete-some-in-order-if-exists')
      .internal(context, authorization, args, path);

    return utils.aggregateGraphError<
      NodeSelectedValue | null,
      DeleteSomeInOrderMutationResult
    >(
      maybeValues,
      (values, maybeValue, index) => {
        if (!maybeValue) {
          throw new NotFoundError(this.node, args.where[index], {
            path: utils.addPath(path, index),
          });
        }

        values.push(maybeValue);

        return values;
      },
      [],
      { path },
    );
  }
}
