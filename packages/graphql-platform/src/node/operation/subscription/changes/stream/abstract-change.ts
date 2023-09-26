import assert from 'node:assert/strict';
import {
  BrokerAcknowledgementKind,
  type BrokerInterface,
} from '../../../../../broker-interface.js';
import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TRequestContext extends object = any,
> {
  readonly #broker: BrokerInterface;
  public explicitAcknowledgement: boolean = false;
  #acknowledged?: BrokerAcknowledgementKind;

  public readonly initiators: ReadonlyArray<TRequestContext>;

  public constructor(
    public readonly subscription: ChangesSubscriptionStream<
      any,
      any,
      TRequestContext
    >,
    initiators: ReadonlyArray<TRequestContext>,
  ) {
    this.#broker = subscription.node.gp.broker;
    this.initiators = Object.freeze(initiators);
  }

  public async acknowledge(
    kind: BrokerAcknowledgementKind = BrokerAcknowledgementKind.ACK,
  ): Promise<void> {
    assert.equal(this.#acknowledged, undefined, `Already acknowledged`);

    try {
      await this.#broker.acknowledgeSubscriptionChange?.(this as any, kind);
    } finally {
      this.#acknowledged = kind;
    }
  }

  public isAcknowledged(): boolean {
    return this.#acknowledged !== undefined;
  }
}
