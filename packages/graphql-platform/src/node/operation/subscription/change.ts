import { Input, NonNillable, Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeSelectedValue } from '../../statement/selection.js';
import type { NodeFilterInputValue } from '../../type/input/filter.js';
import { AbstractSubscription } from '../abstract-subscription.js';
import type { OperationContext } from '../context.js';

export type ChangeSubscriptionArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
}>;

export type ChangeSubscriptionResult = AsyncIterator<
  NonNillable<NodeSelectedValue>
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
  public override readonly name = `changed${this.node.name}`;
  public override readonly description = `Gets the "${this.node.plural}"' change, either it is a creation, an update or a deletion`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
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
    args: NodeSelectionAwareArgs<ChangeSubscriptionArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<ChangeSubscriptionResult> {
    return {
      next: async () => ({
        value: undefined,
        done: true,
      }),
    };
  }
}
