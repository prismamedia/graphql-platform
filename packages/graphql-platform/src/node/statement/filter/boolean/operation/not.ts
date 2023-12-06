import type { NodeSelectedValue, NodeValue } from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue } from '../value.js';
import { AndOperation, type AndOperand } from './and.js';
import { OrOperation, type OrOperand } from './or.js';

export type NotOperand = BooleanExpression | AndOperation | OrOperation;

export interface NotOperationAST {
  kind: 'NOT';
  operand: NotOperand['ast'];
}

/**
 * @see https://en.wikipedia.org/wiki/Negation
 */
export class NotOperation implements BooleanExpressionInterface {
  public static key: string = 'NOT';

  public static create(operand: BooleanFilter): BooleanFilter {
    return operand instanceof BooleanValue || operand instanceof NotOperation
      ? operand.complement
      : operand.complement && operand.complement.score < 1 + operand.score
      ? operand.complement
      : new this(operand);
  }

  public readonly key: string;
  public readonly score: number;

  public constructor(public readonly operand: NotOperand) {
    this.key = (this.constructor as typeof NotOperation).key;
    this.score = 1 + operand.score;
  }

  public equals(expression: unknown): expression is NotOperation {
    return (
      expression instanceof NotOperation &&
      expression.operand.equals(this.operand)
    );
  }

  public get complement(): NotOperand {
    return this.operand;
  }

  public and(
    _operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    return;
  }

  public or(
    _operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    return;
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    const result = this.operand.execute(value);

    return result === undefined ? undefined : !result;
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return this.operand.isAffectedByNodeUpdate(update);
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return this.operand.getAffectedGraphByNodeChange(change, visitedRootNodes);
  }

  public get ast(): NotOperationAST {
    return {
      kind: 'NOT',
      operand: this.operand.ast,
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.operand.inputValue };
  }
}
