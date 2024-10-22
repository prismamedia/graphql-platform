import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type {
  NodeSelectedValue,
  UniqueConstraint,
} from '../../../../../../../node.js';
import type { NodeUpdate } from '../../../../../../change.js';
import type { Leaf } from '../../../../../../definition/component.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { AbstractLeafFilter } from './abstract.js';

export class LeafFullTextFilter extends AbstractLeafFilter {
  public readonly key: string;
  public readonly score: number;

  public constructor(
    leaf: Leaf,
    public readonly operator: 'contains' | 'starts_with' | 'ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new utils.UnexpectedValueError(value, `a non-empty string`);
    }

    super(leaf);

    this.key = `${leaf.name}_${operator}`;
    this.score = 2;
  }

  public equals(expression: unknown): expression is LeafFullTextFilter {
    return (
      expression instanceof LeafFullTextFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const leafValue = value[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    if (!leafValue) {
      return false;
    }

    switch (this.operator) {
      case 'contains':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks.some((block) =>
              block.text.includes(this.value),
            )
          : String(leafValue).includes(this.value);

      case 'starts_with':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks
              .at(0)
              ?.text.startsWith(this.value)
          : String(leafValue).startsWith(this.value);

      case 'ends_with':
        return this.leaf.type === scalars.typesByName.DraftJS
          ? (leafValue as scalars.RawDraftContentState).blocks
              .at(-1)
              ?.text.endsWith(this.value)
          : String(leafValue).endsWith(this.value);

      default:
        throw new utils.UnreachableValueError(this.operator);
    }
  }

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return unique.leafSet.has(this.leaf);
  }

  public override isAffectedByRootUpdate(update: NodeUpdate): boolean {
    return (
      update.hasComponentUpdate(this.leaf) &&
      this.execute(update.oldValue) !== this.execute(update.newValue)
    );
  }

  public get ast(): graphql.ConstObjectValueNode {
    return {
      kind: graphql.Kind.OBJECT,
      fields: [
        {
          kind: graphql.Kind.OBJECT_FIELD,
          name: {
            kind: graphql.Kind.NAME,
            value: this.key,
          },
          value: {
            kind: graphql.Kind.STRING,
            value: this.value,
          },
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: this.value };
  }
}
