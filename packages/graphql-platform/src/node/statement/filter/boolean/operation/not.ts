import type { NodeSelectedValue } from '../../../../../node.js';
import type { DependencyGraph } from '../../../../operation/dependency-graph.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import { AndOperand, AndOperation } from './and.js';
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
    return 'complement' in operand &&
      operand.complement &&
      operand.complement.score < 1 + operand.score
      ? // Double negation: NOT (NOT A) = A
        operand.complement
      : new this(operand as NotOperand);
  }

  public readonly key: string;
  public readonly score: number;
  public readonly complement: NotOperand;
  public readonly dependencies?: DependencyGraph;

  public constructor(public readonly operand: NotOperand) {
    this.key = (this.constructor as typeof NotOperation).key;
    this.score = 1 + operand.score;
    this.complement = operand;
    this.dependencies = operand.dependencies;
  }

  public equals(expression: unknown): expression is NotOperation {
    return (
      expression instanceof NotOperation &&
      expression.operand.equals(this.operand)
    );
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
