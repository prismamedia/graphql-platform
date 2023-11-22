import type { NodeSelectedValue, NodeValue } from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import type { LeafInFilterAST } from '../expression/component/leaf/in.js';
import { BooleanValue, FalseValue, TrueValue } from '../value.js';
import { AndOperation, type AndOperand } from './and.js';
import { NotOperation } from './not.js';

export type OrOperand = BooleanExpression | AndOperation | NotOperation;

export interface OrOperationAST {
  kind: 'OR';
  operands: OrOperand['ast'][];
}

export class OrOperation implements BooleanExpressionInterface {
  public static key: string = 'OR';

  protected static reducers(
    remainingReducers: number,
  ): Array<(a: OrOperand, b: OrOperand) => BooleanFilter | undefined> {
    return [
      // Idempotent law: A + A = A
      (a: OrOperand, b: OrOperand) => (a.equals(b) ? a : undefined),
      // Deeper optimizations
      ...(remainingReducers
        ? [
            (a: OrOperand, b: OrOperand) => a.or(b, remainingReducers - 1),
            (a: OrOperand, b: OrOperand) => b.or(a, remainingReducers - 1),
            // Complement law: A + (NOT A) = 1
            (a: OrOperand, b: OrOperand) =>
              ('complement' in a && a.complement?.equals(b)) ||
              ('complement' in b && b.complement?.equals(a))
                ? TrueValue
                : undefined,
            // De Morgan's law: (NOT A) + (NOT B) = NOT (A . B)
            (a: OrOperand, b: OrOperand) =>
              'complement' in a &&
              a.complement &&
              'complement' in b &&
              b.complement
                ? NotOperation.create(
                    AndOperation.create(
                      [a.complement, b.complement],
                      remainingReducers - 1,
                    ),
                  )
                : undefined,
          ]
        : []),
    ];
  }

  /**
   * Use the (non-)monotone laws to reduce/optimize the operands
   *
   * @see https://en.wikipedia.org/wiki/Logical_disjunction
   */
  public static create(
    maybeOperands: ReadonlyArray<BooleanFilter | null | undefined>,
    remainingReducers: number = 2,
  ): BooleanFilter {
    const operands: OrOperand[] = [];

    const queue = Array.from(maybeOperands);
    const reducers = this.reducers(remainingReducers);

    while (queue.length) {
      const maybeOperand = queue.shift();

      const operand =
        maybeOperand === undefined
          ? TrueValue
          : maybeOperand === null
          ? FalseValue
          : maybeOperand;

      // Reduce recursively
      if (operand instanceof BooleanValue) {
        if (operand.value) {
          // Annulment law: A + 1 = 1
          return operand;
        } else {
          // Identity law: A + 0 = A
          continue;
        }
      } else if (operand instanceof OrOperation) {
        // Associative law: A + (B + C) = A + B + C
        queue.unshift(...operand.operands);
      } else if (
        !reducers.length ||
        !operands.some((previousOperand, index) =>
          reducers.some((reducer) => {
            const disjunction = reducer(previousOperand, operand);
            if (
              disjunction &&
              disjunction.score < 1 + previousOperand.score + operand.score
            ) {
              if (previousOperand !== disjunction) {
                operands.splice(index, 1);
                queue.unshift(disjunction);
              }

              return true;
            }

            return false;
          }),
        )
      ) {
        operands.push(operand);
      }
    }

    return operands.length === 0
      ? // An empty disjunction is FALSE
        FalseValue
      : operands.length === 1
      ? operands[0]
      : new this(operands);
  }

  public readonly key: string;
  public readonly score: number;

  public constructor(
    public readonly operands: ReadonlyArray<OrOperand>,
    public readonly complement?: BooleanFilter,
  ) {
    this.key = (this.constructor as typeof OrOperation).key;
    this.score = 1 + operands.reduce((total, { score }) => total + score, 0);
  }

  public has(expression: unknown): boolean {
    return this.operands.some((operand) => operand.equals(expression));
  }

  public equals(expression: unknown): expression is OrOperation {
    return (
      expression instanceof OrOperation &&
      expression.operands.length === this.operands.length &&
      expression.operands.every((operand) => this.has(operand))
    );
  }

  public and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    // Absorption law: (A + B) . A = A
    if (this.has(operand)) {
      return operand;
    }

    // Distributive law: (A + B) . C = (A . C) + (B . C)
    return OrOperation.create(
      this.operands.map((a) =>
        AndOperation.create([a, operand], remainingReducers),
      ),
      remainingReducers,
    );
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    let hasUndefinedOperand: boolean = false;

    for (const operand of this.operands) {
      const result = operand.execute(value);

      if (result === true) {
        return true;
      } else if (result === undefined) {
        hasUndefinedOperand = true;
      }
    }

    return hasUndefinedOperand ? undefined : false;
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return this.operands.some((operand) =>
      operand.isAffectedByNodeUpdate(update),
    );
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return OrOperation.create(
      this.operands.map((operand) =>
        operand.getAffectedGraphByNodeChange(change, visitedRootNodes),
      ),
    );
  }

  public get ast(): OrOperationAST | LeafInFilterAST {
    return {
      kind: 'OR',
      operands: this.operands.map(({ ast }) => ast),
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.operands.map(({ inputValue }) => inputValue) };
  }
}
