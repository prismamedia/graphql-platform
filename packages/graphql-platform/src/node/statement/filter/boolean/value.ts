import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../node.js';
import type { BooleanExpressionInterface } from './expression-interface.js';

export interface BooleanValueAST {
  kind: 'BOOLEAN';
  value: boolean;
}

export class BooleanValue implements BooleanExpressionInterface {
  public readonly score: number;
  public readonly dependencies?: undefined;

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

  public execute(_nodeValue: Partial<NodeValue>): boolean {
    return this.value;
  }
}

export const TrueValue = new BooleanValue(true);

export const FalseValue = new BooleanValue(false);
