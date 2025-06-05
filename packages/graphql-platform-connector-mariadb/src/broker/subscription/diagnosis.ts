import type { MariaDBSubscription } from '../subscription.js';

export interface MariaDBSubscriptionAssignmentDiagnosis {
  mutationCount: number;
  changeCount: number;
  latencyInSeconds: number;
}

export class MariaDBSubscriptionDiagnosis {
  public constructor(
    public readonly subscription: MariaDBSubscription,
    public readonly assigned: MariaDBSubscriptionAssignmentDiagnosis,
    public readonly unassigned: MariaDBSubscriptionAssignmentDiagnosis,
  ) {}
}
