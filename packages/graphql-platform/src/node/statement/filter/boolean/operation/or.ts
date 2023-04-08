import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { NodeValue } from '../../../../../node.js';
import {
  mergeDependencyTrees,
  type DependencyTree,
} from '../../../../result-set.js';
import { isBooleanFilter, type BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue } from '../value.js';
import { AndOperation } from './and.js';
import { NotOperation } from './not.js';

export interface OrOperationAST {
  kind: 'BooleanOperation';
  operator: 'Or';
  operands: OrOperand['ast'][];
}

export type OrOperand =
  | AndOperation
  | BooleanExpression
  | BooleanValue<true>
  | NotOperation;

/**
 * Thanks to the "associativity" (-> A OR (B OR C) = A OR B OR C) we'll store the operands in an optimized tree
 *
 * Then we'll use the (non-)monotone laws to reduce/optimize the operands
 *
 * @see https://en.wikipedia.org/wiki/Logical_disjunction
 */
export class OrOperation implements BooleanExpressionInterface {
  public readonly operands: ReadonlyArray<OrOperand>;

  public constructor(rawOperands: ReadonlyArray<BooleanFilter | undefined>) {
    const operandSet = new Set<Exclude<OrOperand, BooleanValue>>();

    /**
     * We'll use this array to iterate over and reduce every operands
     * As we'll push new operands into it, we cannot use the original "rawOperands", hence the shallow copy
     */
    const shallowCopyOfRawOperands = Array.from(rawOperands);

    for (const rawOperand of shallowCopyOfRawOperands) {
      if (rawOperand === undefined) {
        // Annihilator: A OR 1 = 1
        this.operands = [new BooleanValue(true)];
        return;
      } else if (isBooleanFilter(rawOperand)) {
        // Reduce recursively
        const operand = rawOperand.reduced;

        if (operand instanceof BooleanValue) {
          if (operand.isTrue()) {
            // Annihilator: A OR 1 = 1
            this.operands = [operand];
            return;
          } else {
            // Identity: A OR 0 = A
            continue;
          }
        } else if (operand instanceof OrOperation) {
          // Associativity: A OR (B OR C) = A OR B OR C
          shallowCopyOfRawOperands.push(...operand.operands);
        } else if (
          operand instanceof NotOperation &&
          operand.operand instanceof AndOperation
        ) {
          // De Morgan's laws: NOT (A AND B) = (NOT A) OR (NOT B)
          shallowCopyOfRawOperands.push(
            ...operand.operand.operands.map(
              (operand) => new NotOperation(operand),
            ),
          );
        } else if (
          !Array.from(operandSet).some((currentOperand) => {
            if (currentOperand.equals(operand)) {
              // Idempotence: A OR A = A
              return true;
            }

            const combinedExpression =
              currentOperand.or(operand) ?? operand.or(currentOperand);

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
        throw new utils.UnreachableValueError(rawOperand);
      }
    }

    this.operands = Object.freeze(Array.from(operandSet));
  }

  @Memoize()
  public get reduced(): BooleanFilter {
    return this.operands.length === 0
      ? // An empty disjunction is FALSE
        new BooleanValue(false)
      : this.operands.length === 1
      ? this.operands[0]
      : this;
  }

  public get dependencies(): DependencyTree | undefined {
    return mergeDependencyTrees(
      this.operands.map(({ dependencies }) => dependencies),
    );
  }

  protected has(expression: unknown): boolean {
    return this.operands.some((operand) => operand.equals(expression));
  }

  public equals(expression: unknown): expression is OrOperation {
    return (
      expression instanceof OrOperation &&
      expression.operands.length === this.operands.length &&
      expression.operands.every((operand) => this.has(operand))
    );
  }

  public and(expression: BooleanFilter): BooleanFilter | undefined {
    if (this.has(expression)) {
      // Absorption: (A OR B) AND A = A
      return expression;
    }

    // TODO: Distributivity: (A OR B) AND C = (A AND C) OR (B AND C)
  }

  public get ast(): OrOperationAST {
    return {
      kind: 'BooleanOperation',
      operator: 'Or',
      operands: this.operands.map(({ ast }) => ast),
    };
  }

  public execute(nodeValue: Partial<NodeValue>): boolean | undefined {
    let hasUndefinedOperand: boolean = false;

    for (const operand of this.operands) {
      const result = operand.execute(nodeValue);

      if (result === true) {
        return true;
      } else if (result === undefined) {
        hasUndefinedOperand = true;
      }
    }

    return hasUndefinedOperand ? undefined : false;
  }
}
