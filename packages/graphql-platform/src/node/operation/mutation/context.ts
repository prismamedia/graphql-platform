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

  public commitChanges(): void {
    const committedAt = new Date();

    let change: ChangedNode | undefined;
    while ((change = this.#changes.shift())) {
      change.commit(committedAt);

      this.gp.changes.next(change);
    }

    this.gp.commits.next(this.requestContext);
  }
}
