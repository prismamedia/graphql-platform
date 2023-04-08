import type { NodeValue } from '../../../../../node.js';
import type { DependencyTree } from '../../../../result-set.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpressionInterface } from '../expression-interface.js';
import { BooleanValue } from '../value.js';
import { OrOperation } from './or.js';

export interface NotOperationAST {
  kind: 'BooleanOperation';
  operator: 'Not';
  operand: BooleanFilter['ast'];
}

/**
 * @see https://en.wikipedia.org/wiki/Negation
 */
export class NotOperation implements BooleanExpressionInterface {
  public readonly operand: BooleanFilter;
  public readonly complement: BooleanFilter;
  public readonly reduced: BooleanFilter;

  public constructor(rawOperand: BooleanFilter) {
    this.operand = rawOperand.reduced;

    this.complement = this.operand;

    // Double negation: NOT (NOT A) = A
    this.reduced =
      'complement' in this.operand && this.operand.complement
        ? this.operand.complement.reduced
        : this;
  }

  public get dependencies(): DependencyTree | undefined {
    return this.operand.dependencies;
  }

  public equals(expression: unknown): expression is NotOperation {
    return (
      expression instanceof NotOperation &&
      expression.operand.equals(this.operand)
    );
  }

  public and(expression: BooleanFilter): BooleanFilter | undefined {
    if (this.operand.equals(expression)) {
      // Complementation: A AND (NOT A) = 0
      return new BooleanValue(false);
    }

    if ('complement' in expression && expression.complement) {
      // De Morgan's laws: (NOT A) AND (NOT B) = NOT (A OR B)
      const or = new OrOperation([this.operand, expression.complement]);

      // In order not to have an infinite loop, we apply this rule only if the result is actually reduced
      if (or.reduced !== or) {
        return new NotOperation(or);
      }
    }
  }

  public or(expression: BooleanFilter): BooleanFilter | undefined {
    if (this.operand.equals(expression)) {
      // Complementation: A OR (NOT A) = 1
      return new BooleanValue(true);
    }
  }

  public get ast(): NotOperationAST {
    return {
      kind: 'BooleanOperation',
      operator: 'Not',
      operand: this.operand.ast,
    };
  }

  public execute(nodeValue: Partial<NodeValue>): boolean | undefined {
    const result = this.operand.execute(nodeValue);

    return result === undefined ? undefined : !result;
  }
}
