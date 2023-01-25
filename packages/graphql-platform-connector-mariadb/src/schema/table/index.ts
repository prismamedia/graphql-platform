import type {
  FullTextIndex,
  FullTextIndexDiagnosis,
} from './index/full-text.js';
import type { PlainIndex, PlainIndexDiagnosis } from './index/plain.js';
import type { PrimaryKey, PrimaryKeyDiagnosis } from './index/primary-key.js';
import type { UniqueIndex, UniqueIndexDiagnosis } from './index/unique.js';

export * from './index/full-text.js';
export * from './index/plain.js';
export * from './index/primary-key.js';
export * from './index/unique.js';

export type Index = FullTextIndex | PlainIndex | PrimaryKey | UniqueIndex;

export type IndexDiagnosis =
  | FullTextIndexDiagnosis
  | PlainIndexDiagnosis
  | PrimaryKeyDiagnosis
  | UniqueIndexDiagnosis;
