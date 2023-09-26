import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeSelectedValue } from '../../../../node.js';
import type { DependencyGraph } from '../../../operation/dependency-graph.js';
import type { NodeFilterInputValue } from '../../../type.js';
import type { BooleanExpressionInterface } from './expression-interface.js';

export interface BooleanValueAST {
  kind: 'BOOLEAN';
  value: boolean;
}

export class BooleanValue implements BooleanExpressionInterface {
  public readonly score: number;
  public readonly dependencies?: DependencyGraph;

  public constructor(public readonly value: boolean) {
    assert.equal(typeof value, 'boolean');

    this.score = 0;
  }

  @Memoize()
  public get complement(): BooleanValue {
    return new BooleanValue(!this.value);
  }

  public equals(expression: unknown): expression is BooleanValue {
    return (
      expression instanceof BooleanValue && expression.value === this.value
    );
  }

  public get ast(): BooleanValueAST {
    return {
      kind: 'BOOLEAN',
      value: this.value,
    };
  }

  public execute(_value: NodeSelectedValue): boolean {
    return this.value;
  }

  public get inputValue(): NodeFilterInputValue {
    return this.value ? {} : null;
  }
}

export const TrueValue = new BooleanValue(true);

export const FalseValue = new BooleanValue(false);
