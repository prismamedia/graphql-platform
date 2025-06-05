import type { MariaDBSubscription } from '../subscription.js';

export interface MariaDBSubscriptionAssignmentDiagnosis {
  mutationCount: number;
  changeCount: number;
  latencyInSeconds: number;
}

export class MariaDBSubscriptionDiagnosis {
  /**
   * The number of seconds it took to diagnose the subscription.
   */
  public readonly tookInSeconds: number;

  public constructor(
    public readonly subscription: MariaDBSubscription,
    public readonly assigned: MariaDBSubscriptionAssignmentDiagnosis,
    public readonly unassigned: MariaDBSubscriptionAssignmentDiagnosis,
    public readonly startedAt: Date,
    public readonly endedAt: Date = new Date(),
  ) {
    this.tookInSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;
  }
}
