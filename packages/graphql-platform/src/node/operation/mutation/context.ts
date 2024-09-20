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
   * Optional, enable or disable the changes tracking context-wide
   */
  public changesTracking: boolean = this.gp.nodeChangesTracking;

  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  public readonly changes: Array<NodeChange> = [];

  public override [Symbol.dispose]() {
    super[Symbol.dispose]();
    this.changes.length = 0;
  }

  public track(...changes: ReadonlyArray<NodeChange>): void {
    this.changesTracking && this.changes.push(...changes);
  }
}
