import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { NodeSelectedValue, UniqueConstraint } from '../../../../node.js';
import { AbstractBooleanFilter } from '../abstract.js';

export class BooleanValue extends AbstractBooleanFilter {
  public readonly score: number;

  public constructor(public readonly value: boolean) {
    assert.strictEqual(typeof value, 'boolean');
    super();

    this.score = 0;
  }

  public equals(expression: unknown): expression is BooleanValue {
    return (
      expression instanceof BooleanValue && expression.value === this.value
    );
  }

  @MGetter
  public override get complement(): BooleanValue {
    return new BooleanValue(!this.value);
  }

  public override execute(_value: NodeSelectedValue): boolean {
    return this.value;
  }

  public override isExecutableWithinUniqueConstraint(
    _unique: UniqueConstraint,
  ): boolean {
    return true;
  }

  public get dependency() {
    return undefined;
  }

  public get ast(): graphql.ConstObjectValueNode | graphql.NullValueNode {
    return this.value
      ? { kind: graphql.Kind.OBJECT, fields: [] }
      : { kind: graphql.Kind.NULL };
  }

  public get inputValue() {
    return this.value ? {} : null;
  }
}

export const TrueValue = new BooleanValue(true);

export const FalseValue = new BooleanValue(false);
