export enum SortDirection {
  Ascending = 'ASCENDING',
  Descending = 'DESCENDING',
}

export interface SortValueInterface<TKind extends string> {
  readonly kind: TKind;
  readonly direction: SortDirection;
}

export interface LeafSortValue extends SortValueInterface<'Leaf'> {
  readonly leaf: string;
}

export interface ReverseEdgeCountSortValue
  extends SortValueInterface<'ReverseEdgeCount'> {
  readonly reverseEdge: string;
}

export type SortValue = LeafSortValue | ReverseEdgeCountSortValue;
