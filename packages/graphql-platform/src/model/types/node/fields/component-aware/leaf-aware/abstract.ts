import { Leaf } from '../../../../../components';
import { NodeType } from '../../../../node';
import { AbstractComponentAwareField } from '../abstract';

export abstract class AbstractLeafAwareField extends AbstractComponentAwareField {
  public override readonly public: boolean;
  public override readonly deprecationReason: string | undefined;

  public constructor(node: NodeType, public readonly leaf: Leaf) {
    super(node, leaf);

    this.public = leaf.public;
    this.deprecationReason = leaf.deprecationReason;
  }
}
