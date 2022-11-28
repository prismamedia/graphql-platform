import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { BooleanExpressionInterface } from './expression-interface.js';

export interface BooleanValueAST<TValue extends boolean = boolean> {
  kind: 'BooleanValue';
  value: TValue;
}

export class BooleanValue<TValue extends boolean = boolean>
  implements BooleanExpressionInterface
{
  public readonly reduced: this;

  public constructor(public readonly value: TValue) {
    assert.equal(typeof value, 'boolean');

    this.reduced = this;
  }

  @Memoize()
  public get complement(): BooleanValue<TValue extends true ? false : true> {
    return new BooleanValue<any>(!this.value);
  }

  public equals(expression: unknown): expression is BooleanValue {
    return (
      expression instanceof BooleanValue && expression.value === this.value
    );
  }

  public get ast(): BooleanValueAST<TValue> {
    return {
      kind: 'BooleanValue',
      value: this.value,
    };
  }

  public isTrue(): this is BooleanValue<true> {
    return this.value;
  }

  public isFalse(): this is BooleanValue<false> {
    return !this.value;
  }
}
