import Denque from 'denque';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type {
  NodeSelectedValue,
  NodeValue,
  UniqueConstraint,
} from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import { AbstractBooleanFilter } from '../../abstract.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue, FalseValue, TrueValue } from '../value.js';
import { AndOperation, type AndOperand } from './and.js';
import { NotOperation } from './not.js';

export type OrOperand = BooleanExpression | AndOperation | NotOperation;

export class OrOperation extends AbstractBooleanFilter {
  protected static reducers(
    remainingReducers: number,
    _queue: Denque<BooleanFilter>,
  ): Array<(a: OrOperand, b: OrOperand) => BooleanFilter | undefined> {
    return remainingReducers
      ? [
          // Idempotent law: A + A = A
          (a: OrOperand, b: OrOperand) => (a.equals(b) ? a : undefined),
          // Custom disjunctions
          (a: OrOperand, b: OrOperand) => a.or(b, remainingReducers - 1),
          (a: OrOperand, b: OrOperand) => b.or(a, remainingReducers - 1),
          // Complement law: A + (NOT A) = 1
          (a: OrOperand, b: OrOperand) =>
            a.complement?.equals(b) || b.complement?.equals(a)
              ? TrueValue
              : undefined,
          // De Morgan's law: (NOT A) + (NOT B) = NOT (A . B)
          (a: OrOperand, b: OrOperand) =>
            a.complement && b.complement
              ? NotOperation.create(
                  AndOperation.create(
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
   * @see https://en.wikipedia.org/wiki/Logical_disjunction
   */
  public static create(
    rawOperands: Array<BooleanFilter>,
    remainingReducers: number = 5,
  ): BooleanFilter {
    const operands: OrOperand[] = [];

    const queue = new Denque(rawOperands);
    const reducers = this.reducers(remainingReducers, queue);

    while (queue.length) {
      const operand = queue.shift();
      assert(operand != null, `Expects a valid operand`);

      // Reduce recursively
      if (operand instanceof BooleanValue) {
        if (operand.value) {
          // Annulment law: A + 1 = 1
          return operand;
        } else {
          // Identity law: A + 0 = A
          // Do not keep
        }
      } else if (operand instanceof OrOperation) {
        // Associative law: A + (B + C) = A + B + C
        queue.splice(0, 0, ...operand.operands);
      } else if (
        !reducers.length ||
        !operands.some((previousOperand, previousOperandIndex) =>
          reducers.some((reducer) => {
            const reduction = reducer(previousOperand, operand);
            if (
              reduction &&
              reduction.score < 1 + previousOperand.score + operand.score
            ) {
              if (reduction !== previousOperand) {
                operands.splice(previousOperandIndex, 1);

                if (
                  reduction instanceof BooleanValue ||
                  reduction instanceof OrOperation
                ) {
                  queue.unshift(reduction);
                } else {
                  operands.push(reduction);
                }
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

  public readonly key = 'OR' as const;
  public readonly score: number;

  public constructor(public readonly operands: ReadonlyArray<OrOperand>) {
    super();

    this.score =
      1 + operands.reduce((total, operand) => total + operand.score, 0);
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

  public override and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    // Distributive law: (A + B) . (A + C) = A + (B . C)
    if (operand instanceof OrOperation) {
      let thisCommonOperandIndex: number | undefined;
      let otherCommonOperandIndex: number | undefined;

      const commonOperand = this.operands.find(
        (thisOperand, thisOperandIndex) =>
          operand.operands.some((otherOperand, otherOperandIndex) => {
            if (thisOperand.equals(otherOperand)) {
              thisCommonOperandIndex = thisOperandIndex;
              otherCommonOperandIndex = otherOperandIndex;

              return true;
            }

            return false;
          }),
      );

      if (commonOperand) {
        const thisOperands = this.operands.filter(
          (_, index) => index !== thisCommonOperandIndex!,
        );

        const otherOperands = operand.operands.filter(
          (_, index) => index !== otherCommonOperandIndex!,
        );

        return OrOperation.create(
          [
            commonOperand,
            AndOperation.create(
              [
                thisOperands.length === 1
                  ? thisOperands[0]
                  : new OrOperation(thisOperands),
                otherOperands.length === 1
                  ? otherOperands[0]
                  : new OrOperation(otherOperands),
              ],
              remainingReducers,
            ),
          ],
          remainingReducers,
        );
      }
    }

    // Absorption law: (A + B) . A = A
    if (this.has(operand)) {
      return operand;
    }

    // Distributive law: (A + B) . C = (A . C) + (B . C)
    return OrOperation.create(
      this.operands.map((thisOperand) =>
        AndOperation.create([thisOperand, operand], remainingReducers),
      ),
      remainingReducers,
    );
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
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

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return this.operands.every((operand) =>
      operand.isExecutableWithinUniqueConstraint(unique),
    );
  }

  public override isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return this.operands.some((operand) =>
      operand.isAffectedByNodeUpdate(update),
    );
  }

  public override getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter | null {
    const filter = OrOperation.create(
      R.pipe(
        this.operands,
        R.map((operand) =>
          operand.getAffectedGraphByNodeChange(change, visitedRootNodes),
        ),
        R.filter(R.isNonNull),
      ),
    );

    return filter.equals(FalseValue) ? null : filter;
  }

  public get ast(): graphql.ConstObjectValueNode {
    return {
      kind: graphql.Kind.OBJECT,
      fields: [
        {
          kind: graphql.Kind.OBJECT_FIELD,
          name: {
            kind: graphql.Kind.NAME,
            value: this.key,
          },
          value: {
            kind: graphql.Kind.LIST,
            values: this.operands.map(({ ast }) => ast),
          },
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: this.operands.map(({ inputValue }) => inputValue) };
  }
}
