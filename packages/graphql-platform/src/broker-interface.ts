import type { Promisable } from 'type-fest';
import type {
  ChangesSubscriptionStream,
  DependentGraph,
  NodeChange,
  NodeChangeAggregation,
} from './node.js';

export interface NodeChangeSubscriptionInterface
  extends AsyncIterable<NodeChangeAggregation | DependentGraph>,
    AsyncDisposable {}

export interface BrokerInterface {
  /**
   * Notify the broker about the given, local, node-changes
   */
  publish(changes: Iterable<NodeChange>): Promisable<void>;

  /**
   * Do whatever is needed to initialize the subscription and to subscribe to the node-changes
   */
  subscribe(
    subscription: ChangesSubscriptionStream,
  ): Promisable<NodeChangeSubscriptionInterface>;
}
