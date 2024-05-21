import type { Promisable } from 'type-fest';
import type {
  ChangesSubscriptionChange,
  ChangesSubscriptionStream,
  NodeChangeAggregation,
} from './node.js';

export enum BrokerAcknowledgementKind {
  ACK,
  NACK,
  REJECT,
}

export interface BrokerInterface {
  /**
   * Notify the broker about the given, local, node-changes
   */
  onLocalNodeChanges(changes: NodeChangeAggregation): Promisable<void>;

  /**
   * Do whatever is needed to initialize the subscription and to subscribe to the node-changes
   */
  initializeSubscription?(
    subscription: ChangesSubscriptionStream,
  ): Promisable<void>;

  /**
   * Acknowledge the given change has been processed
   */
  acknowledgeSubscriptionChange?(
    change: ChangesSubscriptionChange,
    kind: BrokerAcknowledgementKind,
  ): Promisable<void>;

  /**
   * Dispose the resources used by the given subscription
   */
  disposeSubscription?(
    subscription: ChangesSubscriptionStream,
  ): Promisable<void>;
}
