import type { Promisable } from 'type-fest';
import type {
  ChangesSubscriptionStream,
  DependentGraph,
  MutationContextChanges,
} from './node.js';

export interface NodeChangeSubscriptionInterface
  extends AsyncIterable<MutationContextChanges | DependentGraph>,
    AsyncDisposable {}

export interface BrokerInterface {
  /**
   * Notify the broker about the given, local, node-changes
   */
  publish(changes: MutationContextChanges): Promisable<void>;

  /**
   * Do whatever is needed to initialize the subscription and to subscribe to the node-changes
   */
  subscribe(
    subscription: ChangesSubscriptionStream,
  ): Promisable<NodeChangeSubscriptionInterface>;
}
