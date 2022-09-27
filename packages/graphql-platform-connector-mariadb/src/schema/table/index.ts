import type { ForeignKeyIndex } from './index/foreign-key.js';
import type { FullTextIndex } from './index/full-text.js';
import type { PrimaryKey } from './index/primary-key.js';
import type { UniqueIndex } from './index/unique.js';

export * from './index/foreign-key.js';
export * from './index/full-text.js';
export * from './index/primary-key.js';
export * from './index/unique.js';

export type Index = ForeignKeyIndex | FullTextIndex | PrimaryKey | UniqueIndex;
