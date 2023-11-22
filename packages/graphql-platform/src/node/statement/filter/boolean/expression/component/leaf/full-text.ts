import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  NodeSelectedValue,
  NodeValue,
} from '../../../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../../../change.js';
import type {
  Component,
  Leaf,
} from '../../../../../../definition/component.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { FalseValue, type BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';

export interface LeafFullTextFilterAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  operator: Uppercase<LeafFullTextFilter['operator']>;
  value: LeafFullTextFilter['value'];
}

export class LeafFullTextFilter implements BooleanExpressionInterface {
  public readonly key: string;

  public readonly component: Component;
  public readonly score: number;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'contains' | 'starts_with' | 'ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new utils.UnexpectedValueError(value, `a non-empty string`);
    }

    this.key = `${leaf.name}_${operator}`;

    this.component = leaf;
    this.score = 2;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafFullTextFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.value === this.value
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
    const leafValue = value[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    if (!leafValue) {
      return false;
    }

    switch (this.operator) {
      case 'contains':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks.some((block) =>
              block.text.includes(this.value),
            )
          : leafValue.includes(this.value);

      case 'starts_with':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks
              .at(0)
              ?.text.startsWith(this.value)
          : leafValue.startsWith(this.value);

      case 'ends_with':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks
              .at(-1)
              ?.text.endsWith(this.value)
          : leafValue.endsWith(this.value);

      default:
        throw new utils.UnreachableValueError(this.operator);
    }
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return (
      update.hasComponentUpdate(this.leaf) &&
      this.execute(update.oldValue) !== this.execute(update.newValue)
    );
  }

  public getAffectedGraphByNodeChange(
    _change: NodeChange,
    _visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return FalseValue;
  }

  public get ast(): LeafFullTextFilterAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      operator: this.operator.toUpperCase() as any,
      value: this.value,
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.value };
  }
}
