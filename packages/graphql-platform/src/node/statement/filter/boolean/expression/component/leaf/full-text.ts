import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { NodeValue } from '../../../../../../../node.js';
import type { Leaf } from '../../../../../../definition/component/leaf.js';
import type { DependencyTree } from '../../../../../../result-set.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';

export interface LeafFullTextFilterAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  operator: Uppercase<LeafFullTextFilter['operator']>;
  value: LeafFullTextFilter['value'];
}

export class LeafFullTextFilter implements BooleanExpressionInterface {
  public readonly score: number = 2;
  public readonly dependencies: DependencyTree;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'contains' | 'starts_with' | 'ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new utils.UnexpectedValueError(value, `a non-empty string`);
    }

    this.dependencies = new Map([[leaf, undefined]]);
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

  public get ast(): LeafFullTextFilterAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      operator: this.operator.toUpperCase() as any,
      value: this.value,
    };
  }

  public execute(nodeValue: Partial<NodeValue>): boolean | undefined {
    const leafValue = nodeValue[this.leaf.name];
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
}
