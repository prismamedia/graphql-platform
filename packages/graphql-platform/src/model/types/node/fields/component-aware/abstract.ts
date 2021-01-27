import { Component } from '../../../../components';
import { NodeType } from '../../../node';
import { AbstractField } from '../abstract';

export abstract class AbstractComponentAwareField extends AbstractField {
  public constructor(node: NodeType, public readonly component: Component) {
    super(node);
  }
}
