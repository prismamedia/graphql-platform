import * as utils from '@prismamedia/graphql-platform-utils';
import type { NodeValue } from '../../../../../../../node.js';
import type { Leaf } from '../../../../../../definition/component/leaf.js';
import type { DependencyTree } from '../../../../../../result-set.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';

export interface LeafFullTextFilterAST {
  kind: 'LeafFilter';
  leaf: Leaf['name'];
  operator: LeafFullTextFilter['operator'];
  value: LeafFullTextFilter['value'];
}

export class LeafFullTextFilter implements BooleanExpressionInterface {
  public readonly reduced: this;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'contains' | 'starts_with' | 'ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new utils.UnexpectedValueError(value, `a non-empty string`);
    }

    this.reduced = this;
  }

  public get dependencies(): DependencyTree | undefined {
    return new Map([[this.leaf, undefined]]);
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafFullTextFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public and(_expression: unknown) {
    return undefined;
  }

  public or(_expression: unknown) {
    return undefined;
  }

  public get ast(): LeafFullTextFilterAST {
    return {
      kind: 'LeafFilter',
      leaf: this.leaf.name,
      operator: this.operator,
      value: this.value,
    };
  }

  public execute(nodeValue: Partial<NodeValue>): boolean | undefined {
    const leafValue = nodeValue[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    if (!leafValue || !this.value) {
      return false;
    }

    switch (this.operator) {
      case 'contains':
        return leafValue.includes(this.value);

      case 'ends_with':
        return leafValue.endsWith(this.value);

      case 'starts_with':
        return leafValue.startsWith(this.value);
    }
  }
}
