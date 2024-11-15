import Denque from 'denque';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type {
  NodeSelectedValue,
  UniqueConstraint,
} from '../../../../../node.js';
import type { Dependency } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import { AbstractBooleanFilter } from '../../abstract.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue, FalseValue, TrueValue } from '../value.js';
import { NotOperation } from './not.js';
import { OrOperation, type OrOperand } from './or.js';

export type AndOperand = BooleanExpression | OrOperation | NotOperation;

export class AndOperation extends AbstractBooleanFilter {
  protected static reducers(
    remainingReducers: number,
    _queue: Denque<BooleanFilter>,
  ): Array<(a: AndOperand, b: AndOperand) => BooleanFilter | undefined> {
    return remainingReducers
      ? [
          // Idempotent law: A . A = A
          (a: AndOperand, b: AndOperand) => (a.equals(b) ? a : undefined),
          // Custom conjunctions
          (a: AndOperand, b: AndOperand) => a.and(b, remainingReducers - 1),
          (a: AndOperand, b: AndOperand) => b.and(a, remainingReducers - 1),
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
    rawOperands: Array<BooleanFilter>,
    remainingReducers: number = 5,
  ): BooleanFilter {
    const operands: AndOperand[] = [];

    const queue = new Denque(rawOperands);
    const reducers = this.reducers(remainingReducers, queue);

    while (queue.length) {
      const operand = queue.shift();
      assert(operand != null, `Expects a valid operand`);

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
                  reduction instanceof AndOperation
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
      ? // An empty conjunction is TRUE
        TrueValue
      : operands.length === 1
        ? operands[0]
        : new this(operands);
  }

  public readonly key = 'AND' as const;
  public readonly score: number;

  public constructor(public readonly operands: ReadonlyArray<AndOperand>) {
    super();

    this.score =
      1 + operands.reduce((total, operand) => total + operand.score, 0);
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

  public override or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    // Distributive law: (A . B) + (A . C) = A . (B + C)
    if (operand instanceof AndOperation) {
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

        return AndOperation.create(
          [
            commonOperand,
            OrOperation.create(
              [
                thisOperands.length === 1
                  ? thisOperands[0]
                  : new AndOperation(thisOperands),
                otherOperands.length === 1
                  ? otherOperands[0]
                  : new AndOperation(otherOperands),
              ],
              remainingReducers,
            ),
          ],
          remainingReducers,
        );
      }
    }

    // Absorption law: (A . B) + A = A
    if (this.has(operand)) {
      return operand;
    }

    // Distributive law: (A . B) + C = (A + C) . (B + C)
    return AndOperation.create(
      this.operands.map((thisOperand) =>
        OrOperation.create([thisOperand, operand], remainingReducers),
      ),
      remainingReducers,
    );
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
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

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return this.operands.every((operand) =>
      operand.isExecutableWithinUniqueConstraint(unique),
    );
  }

  public get dependency(): ReadonlyArray<Dependency | undefined> {
    return this.operands.flatMap(({ dependency }) => dependency);
  }

  public get ast(): graphql.ConstObjectValueNode {
    const firstOperandsByKey = new Map<AndOperand['key'], AndOperand>();
    const rest: AndOperand[] = [];

    for (const operand of this.operands) {
      if (firstOperandsByKey.has(operand.key)) {
        rest.push(operand);
      } else {
        firstOperandsByKey.set(operand.key, operand);
      }
    }

    const fields: graphql.ConstObjectFieldNode[] = [];

    for (const { ast } of firstOperandsByKey.values()) {
      fields.push(...ast.fields);
    }

    if (rest.length) {
      fields.push({
        kind: graphql.Kind.OBJECT_FIELD,
        name: {
          kind: graphql.Kind.NAME,
          value: this.key,
        },
        value: {
          kind: graphql.Kind.LIST,
          values: rest.map(({ ast }) => ast),
        },
      });
    }

    return {
      kind: graphql.Kind.OBJECT,
      fields,
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    const firstOperandsByKey = new Map<AndOperand['key'], AndOperand>();
    const rest: AndOperand[] = [];

    for (const operand of this.operands) {
      if (firstOperandsByKey.has(operand.key)) {
        rest.push(operand);
      } else {
        firstOperandsByKey.set(operand.key, operand);
      }
    }

    return Object.assign(
      firstOperandsByKey
        .values()
        .reduce(
          (output, { inputValue }) => Object.assign(output, inputValue),
          Object.create(null),
        ),
      rest.length
        ? { [this.key]: rest.map(({ inputValue }) => inputValue) }
        : undefined,
    );
  }
}
