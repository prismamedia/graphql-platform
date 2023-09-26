import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { NodeChangeAggregation, type NodeChange } from '../../change.js';
import { OperationContext } from '../context.js';

export class MutationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends OperationContext<TRequestContext, TConnector, TBroker, TContainer> {
  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  readonly #changes: NodeChange[] = [];

  public get changes(): ReadonlyArray<NodeChange<TRequestContext>> {
    return this.#changes;
  }

  public appendChange(change: NodeChange): void {
    this.#changes.push(change);
  }

  public commitChanges(at: Date = new Date()): void {
    for (const change of this.#changes) {
      change.committedAt = at;
    }
  }

  public aggregateChanges(): NodeChangeAggregation<TRequestContext> {
    return new NodeChangeAggregation(this.#changes);
  }
}
