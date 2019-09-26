export interface ISortValue<TKind extends string> {
  readonly kind: TKind;
  readonly direction: 'ASC' | 'DESC';
}

export interface ILeafSortValue extends ISortValue<'Leaf'> {
  readonly leaf: string;
}

export type TSortValue = ILeafSortValue;
