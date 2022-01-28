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

  public get changes(): ReadonlyArray<
    ChangedNode<TRequestContext, TConnector>
  > {
    return this.#changes;
  }

  public trackChange(change: ChangedNode<TRequestContext, TConnector>): void {
    this.#changes.push(change);
  }

  public commitChanges(): void {
    let change: ChangedNode<TRequestContext, TConnector> | undefined;

    const committedAt = new Date();
    while ((change = this.#changes.shift())) {
      change.commit(committedAt);

      change.node.changes.next(change);
    }
  }
}
