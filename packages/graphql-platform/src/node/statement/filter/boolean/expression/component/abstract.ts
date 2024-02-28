import type { Component } from '../../../../../../node.js';
import { AbstractBooleanExpression } from '../abstract.js';

export abstract class AbstractComponentFilter extends AbstractBooleanExpression {
  public constructor(public readonly component: Component) {
    super();
  }
}
