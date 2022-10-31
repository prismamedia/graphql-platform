import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection.js';
import type { NodeFilterInputValue } from '../../type/input/filter.js';
import { AbstractSubscription } from '../abstract-subscription.js';
import type { OperationContext } from '../context.js';

export type ChangeSubscriptionArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
}>;

export type ChangeSubscriptionResult = AsyncIterator<
  utils.NonNillable<NodeSelectedValue>
>;

export class ChangeSubscription<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractSubscription<
  TRequestContext,
  TConnector,
  ChangeSubscriptionArgs,
  ChangeSubscriptionResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `changed${this.node}`;
  public override readonly description = `Gets the "${this.node.plural}"' changes, either it is a creation, an update or a deletion`;

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
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<ChangeSubscriptionArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<ChangeSubscriptionResult> {
    // Initialize the subscription here

    return {
      next: async () => ({
        value: undefined,
        done: true,
      }),
    };
  }
}
