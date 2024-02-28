import type { Leaf } from '../../../../../../../node.js';
import { AbstractComponentFilter } from '../abstract.js';

export abstract class AbstractLeafFilter extends AbstractComponentFilter {
  public constructor(public readonly leaf: Leaf) {
    super(leaf);
  }
}
