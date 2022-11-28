import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeValue } from '../../../node.js';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection.js';
import type { NodeFilterInputValue } from '../../type/input/filter.js';
import { AbstractSubscription } from '../abstract-subscription.js';
import type { OperationContext } from '../context.js';

export type ChangesSubscriptionArgs = {
  where?: NodeFilterInputValue;
};

export type NodeSelectedValueChange =
  | {
      kind: utils.MutationType.CREATION;
      newValue: NodeSelectedValue;
    }
  | {
      kind: utils.MutationType.UPDATE;
      oldValue: NodeValue;
      newValue: NodeSelectedValue;
    }
  | {
      kind: utils.MutationType.DELETION;
      oldValue: NodeValue;
    };

export type ChangesSubscriptionResult = AsyncIterator<NodeSelectedValueChange>;

export class ChangesSubscription<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractSubscription<
  TRequestContext,
  TConnector,
  ChangesSubscriptionArgs,
  ChangesSubscriptionResult
> {
  protected override readonly selectionAware = false;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}Changes`;
  public override readonly description = `Subscribe to the "${this.node.plural}"' changes`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLUnionType({
        name: `${this.node}Change`,
        types: [
          new graphql.GraphQLObjectType({
            name: `${this.node}Creation`,
            fields: {
              kind: {
                type: new graphql.GraphQLNonNull(utils.MutationTypeType),
              },
              newValue: {
                type: new graphql.GraphQLNonNull(
                  this.node.outputType.getGraphQLObjectType(),
                ),
              },
            },
            isTypeOf: (change) => change.kind === utils.MutationType.CREATION,
          }),
          new graphql.GraphQLObjectType({
            name: `${this.node}Update`,
            fields: {
              kind: {
                type: new graphql.GraphQLNonNull(utils.MutationTypeType),
              },
              oldValue: {
                type: new graphql.GraphQLNonNull(
                  this.node.outputType.getGraphQLObjectType(),
                ),
              },
              newValue: {
                type: new graphql.GraphQLNonNull(
                  this.node.outputType.getGraphQLObjectType(),
                ),
              },
            },
            isTypeOf: (change) => change.kind === utils.MutationType.UPDATE,
          }),
          new graphql.GraphQLObjectType({
            name: `${this.node}Deletion`,
            fields: {
              kind: {
                type: new graphql.GraphQLNonNull(utils.MutationTypeType),
              },
              oldValue: {
                type: new graphql.GraphQLNonNull(
                  this.node.outputType.getGraphQLObjectType(),
                ),
              },
            },
            isTypeOf: (change) => change.kind === utils.MutationType.DELETION,
          }),
        ],
      }),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<ChangesSubscriptionArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<ChangesSubscriptionResult> {
    /**
     * Initialize the subscription & store the state
     * Let the client chose the transport
     */

    return {
      next: async () => ({
        value: undefined,
        done: true,
      }),
    };
  }
}
