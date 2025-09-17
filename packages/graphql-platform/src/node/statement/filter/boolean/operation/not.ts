import * as graphql from 'graphql';
import type { NodeChange } from '../../../../change.js';
import type { NodeFilterInputValue } from '../../../../type.js';
import type { NodeSelectedValue, NodeSelection } from '../../../selection.js';
import { AbstractBooleanFilter } from '../../abstract.js';
import type { BooleanFilter } from '../../boolean.js';
import type { BooleanExpression } from '../expression.js';
import { BooleanValue } from '../value.js';
import { AndOperation } from './and.js';
import { OrOperation } from './or.js';

export type NotOperand = BooleanExpression | AndOperation | OrOperation;

/**
 * @see https://en.wikipedia.org/wiki/Negation
 */
export class NotOperation extends AbstractBooleanFilter {
  public static create(operand: BooleanFilter): BooleanFilter {
    return operand instanceof BooleanValue || operand instanceof NotOperation
      ? operand.complement
      : operand.complement && operand.complement.score < 1 + operand.score
        ? operand.complement
        : new this(operand);
  }

  public readonly key = 'NOT' as const;
  public readonly score: number;

  public constructor(public readonly operand: NotOperand) {
    super();

    this.score = 1 + operand.score;
  }

  public equals(expression: unknown): expression is NotOperation {
    return (
      expression instanceof NotOperation &&
      expression.operand.equals(this.operand)
    );
  }

  public override get complement(): NotOperand {
    return this.operand;
  }

  public override isExecutableWithin(selection: NodeSelection): boolean {
    return this.operand.isExecutableWithin(selection);
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const result = this.operand.execute(value);

    return result === undefined ? undefined : !result;
  }

  public override isEdgeHeadChangeFilteredOut(change: NodeChange): boolean {
    return !this.operand.isEdgeHeadChangeFilteredOut(change);
  }

  public override get dependencies() {
    return this.operand.dependencies;
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
          value: this.operand.ast,
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: this.operand.inputValue };
  }
}
