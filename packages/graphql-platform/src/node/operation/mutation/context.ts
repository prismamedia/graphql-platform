import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeChange } from '../../change.js';
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
  public readonly changes: NodeChange[] = [];

  public commitChanges(at: Date = new Date()): void {
    for (const change of this.changes) {
      change.committedAt = at;
    }
  }
}
