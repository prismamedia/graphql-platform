import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeChange } from '../../change.js';
import { OperationContext } from '../context.js';

export class MutationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends OperationContext<TRequestContext, TConnector> {
  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  readonly changes: NodeChange<TRequestContext, TConnector>[] = [];
}
