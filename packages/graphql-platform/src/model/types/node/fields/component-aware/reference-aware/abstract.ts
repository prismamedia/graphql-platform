import { Reference } from '../../../../../components';
import { NodeType } from '../../../../node';
import { AbstractComponentAwareField } from '../abstract';

export abstract class AbstractReferenceAwareField extends AbstractComponentAwareField {
  public override readonly public: boolean;
  public override readonly deprecationReason: string | undefined;

  public constructor(node: NodeType, public readonly reference: Reference) {
    super(node, reference);

    this.public =
      reference.public && reference.referencedUniqueConstraint.model.public;
    this.deprecationReason = reference.deprecationReason;
  }
}
