import type { JsonObject } from 'type-fest';
import type { MariaDBSubscription } from '../subscription.js';

export interface MariaDBSubscriptionAssignmentDiagnosis {
  mutationCount: number;
  changeCount: number;
  oldestCommitDate?: Date;
  newestCommitDate?: Date;
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
    public readonly diagnosedAt: Date,
    public readonly endedAt: Date = new Date(),
  ) {
    this.tookInSeconds = (endedAt.getTime() - diagnosedAt.getTime()) / 1000;
  }

  public toJSON(): JsonObject {
    return {
      subscription: this.subscription.subscription.id,
      diagnosedAt: this.diagnosedAt.toISOString(),
      tookInSeconds: this.tookInSeconds,
      ...(this.assigned.mutationCount && {
        assigned: {
          mutationCount: this.assigned.mutationCount,
          changeCount: this.assigned.changeCount,
          oldestCommitDate:
            this.assigned.oldestCommitDate?.toISOString() ?? null,
          newestCommitDate:
            this.assigned.newestCommitDate?.toISOString() ?? null,
          latencyInSeconds: this.assigned.latencyInSeconds,
        },
      }),
      ...(this.unassigned.mutationCount && {
        unassigned: {
          mutationCount: this.unassigned.mutationCount,
          changeCount: this.unassigned.changeCount,
          oldestCommitDate:
            this.unassigned.oldestCommitDate?.toISOString() ?? null,
          newestCommitDate:
            this.unassigned.newestCommitDate?.toISOString() ?? null,
          latencyInSeconds: this.unassigned.latencyInSeconds,
        },
      }),
    };
  }
}
