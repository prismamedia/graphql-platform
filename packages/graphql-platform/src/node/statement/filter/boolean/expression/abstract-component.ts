import type { Component } from '../../../../definition.js';
import { AbstractBooleanExpression } from '../abstract-expression.js';

export abstract class AbstractComponentFilter extends AbstractBooleanExpression {
  public constructor(public readonly component: Component) {
    super();
  }
}
