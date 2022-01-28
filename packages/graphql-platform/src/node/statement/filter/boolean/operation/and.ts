import { UnreachableValueError } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { isBooleanFilter, type BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue } from '../value.js';
import { NotOperation } from './not.js';
import { OrOperation } from './or.js';

export interface AndOperationAST {
  kind: 'BooleanOperation';
  operator: 'And';
  operands: AndOperand['ast'][];
}

export type AndOperand =
  | BooleanExpression
  | BooleanValue<false>
  | NotOperation
  | OrOperation;

/**
 * Thanks to the "associativity" (-> A AND (B AND C) = A AND B AND C) we'll store the operands in an optimized tree
 *
 * Then we'll use the (non-)monotone laws to reduce/optimize the operands
 *
 * @see https://en.wikipedia.org/wiki/Logical_conjunction
 */
export class AndOperation implements BooleanExpressionInterface {
  public readonly operands: ReadonlyArray<AndOperand>;

  public constructor(rawOperands: ReadonlyArray<BooleanFilter | undefined>) {
    const operandSet = new Set<Exclude<AndOperand, BooleanValue>>();

    /**
     * We'll use this array to iterate over and reduce every operands
     * As we'll push new operands into it, we cannot use the original "rawOperands", hence the shallow copy
     */
    const shallowCopyOfRawOperands = Array.from(rawOperands);

    for (const rawOperand of shallowCopyOfRawOperands) {
      if (rawOperand === undefined) {
        // Identity: A AND 1 = A
        continue;
      } else if (isBooleanFilter(rawOperand)) {
        // Reduce recursively
        const operand = rawOperand.reduced;

        if (operand instanceof BooleanValue) {
          if (operand.isFalse()) {
            // Annihilator: A AND 0 = 0
            this.operands = [operand];
            return;
          } else {
            // Identity: A AND 1 = A
            continue;
          }
        } else if (operand instanceof AndOperation) {
          // Associativity: A AND (B AND C) = A AND B AND C
          shallowCopyOfRawOperands.push(...operand.operands);
        } else if (
          operand instanceof NotOperation &&
          operand.operand instanceof OrOperation
        ) {
          // De Morgan's laws: NOT (A OR B) = (NOT A) AND (NOT B)
          shallowCopyOfRawOperands.push(
            ...operand.operand.operands.map(
              (operand) => new NotOperation(operand),
            ),
          );
        } else if (
          !Array.from(operandSet).some((currentOperand) => {
            if (currentOperand.equals(operand)) {
              // Idempotence: A AND A = A
              return true;
            }

            const combinedExpression =
              currentOperand.and(operand) ?? operand.and(currentOperand);

            if (combinedExpression) {
              if (combinedExpression !== currentOperand) {
                operandSet.delete(currentOperand);
                shallowCopyOfRawOperands.push(combinedExpression);
              }

              return true;
            }

            return false;
          })
        ) {
          operandSet.add(operand);
        }
      } else {
        throw new UnreachableValueError(rawOperand);
      }
    }

    this.operands = Array.from(operandSet);
  }

  @Memoize()
  public get reduced(): BooleanFilter {
    return this.operands.length === 0
      ? // An empty conjunction is TRUE
        new BooleanValue(true)
      : this.operands.length === 1
      ? this.operands[0]
      : this;
  }

  protected has(expression: unknown): boolean {
    return this.operands.some((operand) => operand.equals(expression));
  }

  public equals(expression: unknown): expression is AndOperation {
    return (
      expression instanceof AndOperation &&
      expression.operands.length === this.operands.length &&
      expression.operands.every((operand) => this.has(operand))
    );
  }

  public or(expression: BooleanFilter): BooleanFilter | undefined {
    if (this.has(expression)) {
      // Absorption: (A AND B) OR A = A
      return expression;
    }

    // TODO: Distributivity: (A AND B) OR C = (A OR C) AND (B OR C)
  }

  public get ast(): AndOperationAST {
    return {
      kind: 'BooleanOperation',
      operator: 'And',
      operands: this.operands.map(({ ast }) => ast),
    };
  }
}
