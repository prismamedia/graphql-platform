import { LeafValue } from '../../../components/leaf';

interface IFilterValue<TKind extends string, TValue> {
  readonly kind: TKind;
  readonly value: TValue;
}

export type BooleanFilterValue = IFilterValue<'Boolean', boolean>;

interface ILogicalFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Logical', TValue> {
  readonly operator: TOperator;
}

export type LogicalFilterValue =
  | ILogicalFilterValue<'and', ReadonlyArray<FilterValue>>
  | ILogicalFilterValue<'or', ReadonlyArray<FilterValue>>
  | ILogicalFilterValue<'not', FilterValue>;

interface ILeafFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Leaf', TValue> {
  readonly leaf: string;
  readonly operator: TOperator;
}

export type LeafFilterValue<TValue extends LeafValue = any> =
  | ILeafFilterValue<'eq', TValue>
  | ILeafFilterValue<'not', TValue>
  | ILeafFilterValue<'gt', TValue>
  | ILeafFilterValue<'gte', TValue>
  | ILeafFilterValue<'lt', TValue>
  | ILeafFilterValue<'lte', TValue>
  | ILeafFilterValue<'in', ReadonlyArray<TValue>>
  | ILeafFilterValue<'not_in', ReadonlyArray<TValue>>;

export type LeafFilterOperator<
  T extends LeafFilterValue['operator'] = LeafFilterValue['operator'],
> = Extract<LeafFilterValue['operator'], T>;

export const isLeafFilterOperatorAmong = (
  maybeOperator: unknown,
  operators: ReadonlyArray<LeafFilterOperator>,
): maybeOperator is LeafFilterOperator =>
  operators.includes(maybeOperator as any);

interface IEdgeFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Edge', TValue> {
  readonly edge: string;
  readonly operator: TOperator;
}

export type EdgeFilterValue =
  | IEdgeFilterValue<'eq', FilterValue>
  | IEdgeFilterValue<'not', FilterValue>;

interface IReverseEdgeFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'ReverseEdge', TValue> {
  readonly reverseEdge: string;
  readonly operator: TOperator;
}

export type ReverseEdgeFilterValue =
  // Unique
  | IReverseEdgeFilterValue<'eq', FilterValue>
  | IReverseEdgeFilterValue<'not', FilterValue>

  // Non-unique
  | IReverseEdgeFilterValue<'none', FilterValue>
  | IReverseEdgeFilterValue<'some', FilterValue>
  | IReverseEdgeFilterValue<'every', FilterValue>;

export type FilterValue =
  | BooleanFilterValue
  | LogicalFilterValue
  | LeafFilterValue
  | EdgeFilterValue
  | ReverseEdgeFilterValue;
