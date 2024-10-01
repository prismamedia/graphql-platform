import * as utils from '@prismamedia/graphql-platform-utils';
import type { NodeSelectionAwareArgs } from '../../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../../statement.js';
import { NotFoundError } from '../../error.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';
import type { UpdateSomeInOrderIfExistsMutationArgs } from './update-some-in-order-if-exists.js';

export type UpdateSomeInOrderMutationArgs =
  UpdateSomeInOrderIfExistsMutationArgs;

export type UpdateSomeInOrderMutationResult = NodeSelectedValue[];

export class UpdateSomeInOrderMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  TRequestContext,
  UpdateSomeInOrderMutationArgs,
  UpdateSomeInOrderMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'update-some-in-order';
  public readonly name = `updateSome${this.node.plural}InOrder`;
  public override readonly description = `Given a list of unique-filter's value, updates the corresponding "${this.node.plural}" then returns their new values in the same order, throws an error if one does not exist`;

  public override get arguments() {
    return this.node.getMutationByKey('update-some-in-order-if-exists')
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
    args: NodeSelectionAwareArgs<UpdateSomeInOrderMutationArgs>,
    path: utils.Path,
  ): Promise<UpdateSomeInOrderMutationResult> {
    const maybeValues = await this.node
      .getMutationByKey('update-some-in-order-if-exists')
      .internal(context, authorization, args, path);

    return utils.aggregateGraphError<
      NodeSelectedValue | null,
      UpdateSomeInOrderMutationResult
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
