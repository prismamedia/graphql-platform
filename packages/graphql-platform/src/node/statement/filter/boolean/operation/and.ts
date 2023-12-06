import Denque from 'denque';
import type { NodeSelectedValue, NodeValue } from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue, FalseValue, TrueValue } from '../value.js';
import { NotOperation } from './not.js';
import { OrOperation, type OrOperand } from './or.js';

export type AndOperand = BooleanExpression | OrOperation | NotOperation;

export interface AndOperationAST {
  kind: 'AND';
  operands: AndOperand['ast'][];
}

export class AndOperation implements BooleanExpressionInterface {
  public static key: string = 'AND';

  protected static reducers(
    remainingReducers: number,
  ): Array<(a: AndOperand, b: AndOperand) => BooleanFilter | undefined> {
    return remainingReducers
      ? [
          // Idempotent law: A . A = A
          (a: AndOperand, b: AndOperand) => (a.equals(b) ? a : undefined),
          // Custom conjunctions
          (a: AndOperand, b: AndOperand) => a.and(b, remainingReducers - 1),
          (a: AndOperand, b: AndOperand) => b.and(a, remainingReducers - 1),
          // Distributive law: (A + B) . (A + C) = A + (B . C)
          (a: AndOperand, b: AndOperand) => {
            if (a instanceof OrOperation && b instanceof OrOperation) {
              const commonOperand = a.operands.find((operand) =>
                b.has(operand),
              );

              if (commonOperand) {
                return OrOperation.create(
                  [
                    commonOperand,
                    AndOperation.create(
                      [
                        OrOperation.create(
                          a.operands.filter(
                            (operand) => !operand.equals(commonOperand),
                          ),
                          0,
                        ),
                        OrOperation.create(
                          b.operands.filter(
                            (operand) => !operand.equals(commonOperand),
                          ),
                          0,
                        ),
                      ],
                      remainingReducers - 1,
                    ),
                  ],
                  remainingReducers - 1,
                );
              }
            }
          },
          // Distributive law: (A + B) . C = (A . C) + (B + C)
          (a: AndOperand, b: AndOperand) =>
            a instanceof OrOperation
              ? OrOperation.create(
                  a.operands.map((aOperand) =>
                    AndOperation.create([aOperand, b], remainingReducers - 1),
                  ),
                  remainingReducers - 1,
                )
              : undefined,
          // Distributive law: A . (B + C) = (A . B) + (A + C)
          (a: AndOperand, b: AndOperand) =>
            b instanceof OrOperation
              ? OrOperation.create(
                  b.operands.map((bOperand) =>
                    AndOperation.create([a, bOperand], remainingReducers - 1),
                  ),
                  remainingReducers - 1,
                )
              : undefined,
          // Complement law: A . (NOT A) = 0
          (a: AndOperand, b: AndOperand) =>
            a.complement?.equals(b) || b.complement?.equals(a)
              ? FalseValue
              : undefined,
          // De Morgan's law: (NOT A) . (NOT B) = NOT (A + B)
          (a: AndOperand, b: AndOperand) =>
            a.complement && b.complement
              ? NotOperation.create(
                  OrOperation.create(
                    [a.complement, b.complement],
                    remainingReducers - 1,
                  ),
                )
              : undefined,
        ]
      : [];
  }

  /**
   * Use the (non-)monotone laws to reduce/optimize the operands
   *
   * @see https://en.wikipedia.org/wiki/Logical_conjunction
   */
  public static create(
    maybeOperands: Array<BooleanFilter | null | undefined>,
    remainingReducers: number = 5,
  ): BooleanFilter {
    const operands: AndOperand[] = [];

    const queue = new Denque(maybeOperands);
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
        if (!operand.value) {
          // Annulment law: A . 0 = 0
          return operand;
        } else {
          // Identity law: A . 1 = A
          continue;
        }
      } else if (operand instanceof AndOperation) {
        // Associative law: A . (B . C) = A . B . C
        queue.splice(0, 0, ...operand.operands);
      } else if (
        !reducers.length ||
        !operands.some((previousOperand, index) =>
          reducers.some((reducer) => {
            const conjunction = reducer(previousOperand, operand);
            if (
              conjunction &&
              conjunction.score < 1 + previousOperand.score + operand.score
            ) {
              if (previousOperand !== conjunction) {
                operands.splice(index, 1);
                queue.unshift(conjunction);
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
      ? // An empty conjunction is TRUE
        TrueValue
      : operands.length === 1
      ? operands[0]
      : new this(operands);
  }

  public readonly key: string;
  public readonly score: number;

  public constructor(public readonly operands: ReadonlyArray<AndOperand>) {
    this.key = (this.constructor as typeof AndOperation).key;
    this.score = 1 + operands.reduce((total, { score }) => total + score, 0);
  }

  public has(expression: unknown): boolean {
    return this.operands.some((operand) => operand.equals(expression));
  }

  public equals(expression: unknown): expression is AndOperation {
    return (
      expression instanceof AndOperation &&
      expression.operands.length === this.operands.length &&
      expression.operands.every((operand) => this.has(operand))
    );
  }

  public get complement(): BooleanFilter | undefined {
    return;
  }

  public or(
    operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    // Absorption law: (A . B) + A = A
    if (this.has(operand)) {
      return operand;
    }
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    let hasUndefinedOperand: boolean = false;

    for (const operand of this.operands) {
      const result = operand.execute(value);

      if (result === false) {
        return false;
      } else if (result === undefined) {
        hasUndefinedOperand = true;
      }
    }

    return hasUndefinedOperand ? undefined : true;
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

  public get ast(): AndOperationAST {
    return {
      kind: 'AND',
      operands: this.operands.map(({ ast }) => ast),
    };
  }

  public get inputValue(): NodeFilterInputValue {
    const firstOperandsByKey = new Map<AndOperand['key'], AndOperand>();
    const rest: AndOperand[] = [];

    for (const operand of this.operands) {
      if (firstOperandsByKey.has(operand.key)) {
        rest.push(operand);
      } else {
        firstOperandsByKey.set(operand.key, operand);
      }
    }

    return {
      ...Array.from(firstOperandsByKey.values()).reduce(
        (output, { inputValue }) => Object.assign(output, inputValue),
        {},
      ),
      ...(rest.length && {
        [this.key]: rest.map(({ inputValue }) => inputValue),
      }),
    };
  }
}
