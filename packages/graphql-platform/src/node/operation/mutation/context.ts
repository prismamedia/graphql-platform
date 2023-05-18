import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  NodeChangeAggregation,
  filterNodeChange,
  type NodeChange,
} from '../../change.js';
import { OperationContext } from '../context.js';

export class MutationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> extends OperationContext<TRequestContext, TConnector, TContainer> {
  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  readonly #changes: NodeChange[] = [];

  public get changes(): ReadonlyArray<
    NodeChange<TRequestContext, TConnector, TContainer>
  > {
    return this.#changes;
  }

  public appendChange(change: NodeChange): boolean {
    if (filterNodeChange(change)) {
      this.#changes.push(change);

      return true;
    }

    return false;
  }

  public commitChanges(at: Date = new Date()): void {
    for (const change of this.#changes) {
      change.committedAt = at;
    }
  }

  public aggregateChanges(): NodeChangeAggregation<
    TRequestContext,
    TConnector,
    TContainer
  > {
    return new NodeChangeAggregation(this.#changes);
  }
}
