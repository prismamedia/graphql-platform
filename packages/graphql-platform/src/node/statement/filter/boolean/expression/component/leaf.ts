import { AbstractLeafFilter } from './leaf/abstract.js';
import { LeafComparisonFilter } from './leaf/comparison.js';
import { LeafFullTextFilter } from './leaf/full-text.js';
import { LeafInFilter } from './leaf/in.js';

export * from './leaf/abstract.js';
export * from './leaf/comparison.js';
export * from './leaf/full-text.js';
export * from './leaf/in.js';

export type LeafFilter =
  | LeafComparisonFilter
  | LeafFullTextFilter
  | LeafInFilter
  | AbstractLeafFilter;

export const isLeafFilter = (
  maybeLeafFilter: unknown,
): maybeLeafFilter is LeafFilter =>
  maybeLeafFilter instanceof LeafComparisonFilter ||
  maybeLeafFilter instanceof LeafFullTextFilter ||
  maybeLeafFilter instanceof LeafInFilter ||
  maybeLeafFilter instanceof AbstractLeafFilter;
