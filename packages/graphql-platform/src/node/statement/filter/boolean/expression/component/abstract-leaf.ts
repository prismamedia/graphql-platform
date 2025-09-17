import type { Leaf } from '../../../../../definition.js';
import type { RawDependency } from '../../../../../dependency.js';
import type { NodeSelection } from '../../../../selection.js';
import { AbstractComponentFilter } from '../abstract-component.js';

export abstract class AbstractLeafFilter extends AbstractComponentFilter {
  public constructor(public readonly leaf: Leaf) {
    super(leaf);
  }

  public override isExecutableWithin(selection: NodeSelection): boolean {
    return selection.expressionsByLeaf.has(this.leaf);
  }

  public override get dependencies(): RawDependency[] {
    return [this.leaf];
  }
}
