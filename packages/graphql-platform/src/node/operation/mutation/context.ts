import * as utils from '@prismamedia/graphql-platform-utils';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { OperationContext } from '../context.js';
import { MutationContextChanges } from './context/changes.js';

export * from './context/changes.js';

export class MutationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends OperationContext<TRequestContext, TConnector, TBroker, TContainer> {
  /**
   * Contains the nodes' changes that will be fired after the success of the whole mutation, including all the nested actions
   */
  public readonly changes: MutationContextChanges<TRequestContext> =
    new MutationContextChanges(
      this.request,
      undefined,
      utils.resolveThunkable(this.gp.maxNodeChanges, this.request),
    );

  public override [Symbol.dispose]() {
    super[Symbol.dispose]();
    this.changes[Symbol.dispose]();
  }
}
