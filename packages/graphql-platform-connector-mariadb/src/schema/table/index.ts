import type { ForeignKey } from './index/foreign-key.js';
import type { PrimaryKey } from './index/primary-key.js';
import type { UniqueIndex } from './index/unique.js';

export * from './index/foreign-key.js';
export * from './index/primary-key.js';
export * from './index/unique.js';

export type Index = ForeignKey | PrimaryKey | UniqueIndex;
