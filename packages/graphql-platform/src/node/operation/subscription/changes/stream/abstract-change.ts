import assert from 'node:assert/strict';
import { BrokerAcknowledgementKind } from '../../../../../broker-interface.js';
import type { ChangesSubscriptionStream } from '../stream.js';

export abstract class AbstractChangesSubscriptionChange<
  TRequestContext extends object = any,
> {
  public manualAcknowledgement: boolean = false;
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
    this.initiators = Object.freeze(initiators);
  }

  public async acknowledge(
    kind: BrokerAcknowledgementKind = BrokerAcknowledgementKind.ACK,
  ): Promise<void> {
    assert.equal(this.#acknowledged, undefined, `Already acknowledged`);
    this.#acknowledged = kind;

    await this.subscription.node.gp.broker.acknowledgeSubscriptionChange?.(
      this as any,
      kind,
    );
  }

  public isAcknowledged(): boolean {
    return this.#acknowledged !== undefined;
  }

  public async handleAutomaticAcknowledgement(): Promise<void> {
    if (!this.manualAcknowledgement && !this.isAcknowledged()) {
      await this.acknowledge(BrokerAcknowledgementKind.ACK);
    }
  }
}
