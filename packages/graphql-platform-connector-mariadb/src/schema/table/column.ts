import type { LeafColumn, LeafColumnDiagnosis } from './column/leaf.js';
import type {
  ReferenceColumn,
  ReferenceColumnDiagnosis,
} from './column/reference.js';

export * from './column/leaf.js';
export * from './column/reference.js';

export type Column = LeafColumn | ReferenceColumn;

export type ColumnDiagnosis = LeafColumnDiagnosis | ReferenceColumnDiagnosis;
