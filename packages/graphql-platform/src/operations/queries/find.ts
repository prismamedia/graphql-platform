import Scalars from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertScalarValue,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { IConnector } from '../../connector';
import { INodeValue, TOrderByInputValue, TWhereInputValue } from '../../node';
import {
  ISelectionsAwareOperationArgs,
  TOperationFieldArgs,
  TWithParsedSelectionsOperationArgs,
} from '../abstract-operation';
import { OperationContext } from '../context';
import { AbstractQuery, IQueryConfig } from './abstract-query';

export interface IFindOperationArgs extends ISelectionsAwareOperationArgs {
  readonly where?: TWhereInputValue;
  readonly orderBy?: TOrderByInputValue;
  readonly skip?: number;
  readonly first: number;
}

export type TFindOperationResult = INodeValue[];

export interface IFindOperationConfig
  extends IQueryConfig<IFindOperationArgs> {}

export class FindOperation extends AbstractQuery<
  IFindOperationArgs,
  TFindOperationResult,
  IFindOperationConfig
> {
  public readonly name: string = camelize(this.node.plural, true);
  public readonly description = `Retrieves a list of "${this.node.name}" nodes`;

  protected async doExecute(
    args: TWithParsedSelectionsOperationArgs<IFindOperationArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TFindOperationResult> {
    const { where, orderBy, skip, first, selections } = {
      ...this.defaultArgs,
      ...args,
    };

    const [contextualizedFilter, contextualizedSelections] = await Promise.all([
      this.node.getContextualizedFilter(where, operationContext.context, path),
      this.node.getContextualizedSelections(
        selections,
        operationContext.context,
        path,
      ),
    ]);

    return contextualizedFilter.kind === 'Boolean' &&
      !contextualizedFilter.value
      ? // In case of a "false" filter, we can save a connector call
        []
      : operationContext.connector.find(
          this.node,
          {
            ...(!(
              contextualizedFilter.kind === 'Boolean' &&
              contextualizedFilter.value
            ) && { filter: contextualizedFilter }),
            ...(orderBy?.length && {
              orderBy: this.node.orderByInput.parseValue(
                orderBy,
                addPath(path, 'orderBy'),
              ),
            }),
            ...(skip !== undefined && {
              skip: assertScalarValue(
                Scalars.NonNegativeInt,
                skip,
                addPath(path, 'skip'),
              ),
            }),
            first: assertScalarValue(
              Scalars.NonNegativeInt,
              first,
              addPath(path, 'first'),
            ),
            selections: contextualizedSelections,
          },
          operationContext,
        );
  }

  protected get graphqlFieldConfigArgs(): TOperationFieldArgs<IFindOperationArgs> {
    return {
      where: {
        type: this.node.whereInput.type,
        defaultValue: this.defaultArgs?.where,
      },
      ...(this.node.orderByInput.type
        ? {
            orderBy: {
              type: GraphQLList(GraphQLNonNull(this.node.orderByInput.type)),
              defaultValue: this.defaultArgs?.orderBy,
            },
          }
        : undefined),
      skip: {
        type: Scalars.NonNegativeInt,
        defaultValue: this.defaultArgs?.skip,
      },
      first: {
        type: GraphQLNonNull(Scalars.NonNegativeInt),
        defaultValue: this.defaultArgs?.first,
      },
    };
  }

  protected get graphqlFieldConfigType() {
    return GraphQLNonNull(GraphQLList(GraphQLNonNull(this.node.type)));
  }
}
