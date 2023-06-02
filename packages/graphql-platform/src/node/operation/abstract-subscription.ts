import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { PascalCase } from 'type-fest';
import { AbstractOperation } from '../abstract-operation.js';

export abstract class AbstractSubscription<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult extends AsyncIterator<any>,
> extends AbstractOperation<TRequestContext, TArgs, TResult> {
  public readonly operationType = graphql.OperationTypeNode.SUBSCRIPTION;

  /**
   * This is unique for a node
   *
   * It identifies the operation for a given node
   */
  @Memoize()
  public get method(): `subscribeTo${PascalCase<this['key']>}` {
    return `subscribeTo${this.key.replaceAll(/((?:^|-).)/g, (_match, letter) =>
      letter.toUpperCase(),
    )}` as any;
  }

  @Memoize()
  public override isEnabled(): boolean {
    return false;
  }

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  > {
    assert(this.isPublic(), `The "${this}" ${this.operationType} is private`);

    return {
      ...(this.description && { description: this.description }),
      ...(this.node.deprecationReason && {
        deprecationReason: this.node.deprecationReason,
      }),
      ...(this.arguments?.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLOutputType(),
      subscribe: (_, args, context, info) =>
        this.execute(
          context,
          (this.selectionAware ? { ...args, selection: info } : args) as TArgs,
          info.path,
        ).catch((error) => {
          throw error instanceof utils.GraphError
            ? error.toGraphQLError()
            : error;
        }),
    };
  }
}
