import type { Promisable } from 'type-fest';
import type {
  ChangesSubscriptionStream,
  NodeChangeAggregation,
} from './node.js';

export interface NodeChangeAggregationSubscriptionInterface
  extends AsyncIterable<NodeChangeAggregation>,
    AsyncDisposable {}

export interface BrokerInterface {
  /**
   * Notify the broker about the given, local, node-changes
   */
  publish(changes: NodeChangeAggregation): Promisable<void>;

  /**
   * Do whatever is needed to initialize the subscription and to subscribe to the node-changes
   */
  subscribe(
    subscription: ChangesSubscriptionStream,
  ): Promisable<NodeChangeAggregationSubscriptionInterface>;
}
