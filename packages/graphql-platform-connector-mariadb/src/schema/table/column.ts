import type { LeafColumn, LeafColumnDiagnosis } from './column/leaf.js';
import type {
  ReferenceColumn,
  ReferenceColumnDiagnosis,
} from './column/reference.js';
import type {
  SubscriptionsStateColumn,
  SubscriptionsStateColumnDiagnosis,
} from './column/subscriptions-state.js';

export * from './column/leaf.js';
export * from './column/reference.js';
export * from './column/subscriptions-state.js';

export type Column = LeafColumn | ReferenceColumn | SubscriptionsStateColumn;

export type ColumnDiagnosis =
  | LeafColumnDiagnosis
  | ReferenceColumnDiagnosis
  | SubscriptionsStateColumnDiagnosis;
