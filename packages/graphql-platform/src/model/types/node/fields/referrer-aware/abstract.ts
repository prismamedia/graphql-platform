import { Referrer } from '../../../../referrer';
import { NodeType } from '../../../node';
import { AbstractField } from '../abstract';

export abstract class AbstractReferrerAwareField extends AbstractField {
  public override readonly public: boolean;
  public override readonly deprecationReason: string | undefined;

  public constructor(node: NodeType, public readonly referrer: Referrer) {
    super(node);

    this.public = referrer.public && referrer.originalReference.model.public;
    this.deprecationReason = referrer.deprecationReason;
  }
}
