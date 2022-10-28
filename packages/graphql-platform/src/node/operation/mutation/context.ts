import type { ConnectorInterface } from '../../../connector-interface.js';
import type { ChangedNode } from '../../change.js';
import { OperationContext } from '../context.js';

export class MutationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends OperationContext<TRequestContext, TConnector> {
  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  readonly #changes: Array<ChangedNode<TRequestContext, TConnector>> = [];

  public trackChange(change: ChangedNode<TRequestContext, TConnector>): void {
    this.#changes.push(change);
  }

  public commitChanges(at: Date = new Date()): void {
    this.#changes.forEach((change) => change.commit(at));
  }

  public notifyChanges(): void {
    let change: ChangedNode | undefined;
    while ((change = this.#changes.shift())) {
      this.gp.changes.next(change);
    }
  }
}
