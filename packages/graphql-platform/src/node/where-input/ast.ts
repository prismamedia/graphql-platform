import { TLeafValue } from '../component/leaf';

interface IFilterValue<TKind extends string, TValue> {
  readonly kind: TKind;
  readonly value: TValue;
}

export type TBooleanFilterValue = IFilterValue<'Boolean', boolean>;

interface ILogicalFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Logical', TValue> {
  readonly operator: TOperator;
}

export type TLogicalFilterValue =
  | ILogicalFilterValue<'and', ReadonlyArray<TFilterValue>>
  | ILogicalFilterValue<'or', ReadonlyArray<TFilterValue>>
  | ILogicalFilterValue<'not', TFilterValue>;

interface ILeafFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Leaf', TValue> {
  readonly leaf: string;
  readonly operator: TOperator;
}

export type TLeafFilterValue<TValue extends TLeafValue = any> =
  | ILeafFilterValue<'eq', TValue>
  | ILeafFilterValue<'not', TValue>
  | ILeafFilterValue<'gt', TValue>
  | ILeafFilterValue<'gte', TValue>
  | ILeafFilterValue<'lt', TValue>
  | ILeafFilterValue<'lte', TValue>
  | ILeafFilterValue<'in', ReadonlyArray<TValue>>
  | ILeafFilterValue<'not_in', ReadonlyArray<TValue>>;

export type TLeafFilterOperator<
  T extends TLeafFilterValue['operator'] = TLeafFilterValue['operator']
> = Extract<TLeafFilterValue['operator'], T>;

export const isLeafFilterOperatorAmong = (
  maybeOperator: unknown,
  operators: ReadonlyArray<TLeafFilterOperator>,
): maybeOperator is TLeafFilterOperator =>
  operators.includes(maybeOperator as any);

interface IEdgeFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'Edge', TValue> {
  readonly edge: string;
  readonly operator: TOperator;
}

export type TEdgeFilterValue =
  | IEdgeFilterValue<'eq', TFilterValue>
  | IEdgeFilterValue<'not', TFilterValue>;

interface IReverseEdgeFilterValue<TOperator extends string, TValue>
  extends IFilterValue<'ReverseEdge', TValue> {
  readonly reverseEdge: string;
  readonly operator: TOperator;
}

export type TReverseEdgeFilterValue =
  // Unique
  | IReverseEdgeFilterValue<'eq', TFilterValue>
  | IReverseEdgeFilterValue<'not', TFilterValue>

  // Non-unique
  | IReverseEdgeFilterValue<'none', TFilterValue>
  | IReverseEdgeFilterValue<'some', TFilterValue>
  | IReverseEdgeFilterValue<'every', TFilterValue>;

export type TFilterValue =
  | TBooleanFilterValue
  | TLogicalFilterValue
  | TLeafFilterValue
  | TEdgeFilterValue
  | TReverseEdgeFilterValue;
