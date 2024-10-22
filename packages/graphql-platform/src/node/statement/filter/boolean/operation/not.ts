import * as graphql from 'graphql';
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

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const result = this.operand.execute(value);

    return result === undefined ? undefined : !result;
  }

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return this.operand.isExecutableWithinUniqueConstraint(unique);
  }

  public override isAffectedByRootUpdate(update: NodeUpdate): boolean {
    return this.operand.isAffectedByRootUpdate(update);
  }

  public override getAffectedGraph(
    change: NodeChange,
    visitedRootNodes?: ReadonlyArray<NodeValue>,
  ): BooleanFilter | null {
    return this.operand.getAffectedGraph(change, visitedRootNodes);
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
