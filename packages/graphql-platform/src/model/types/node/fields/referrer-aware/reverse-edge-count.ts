import { Scalars } from '@prismamedia/graphql-platform-scalars';
import { Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { strict as assert } from 'assert';
import { FieldNode, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Referrer } from '../../../../referrer';
import { ASTContext, NodeType } from '../../../node';
import { AbstractSelection } from '../abstract';
import {
  assertGraphQLFieldNodeWithoutSelectionSet,
  assertHomogeneousSelections,
} from '../assertions';
import { AbstractReferrerAwareField } from './abstract';

export class ReverseEdgeCountSelection extends AbstractSelection<ReverseEdgeCountField> {
  public constructor(
    field: ReverseEdgeCountField,
    public readonly args?: string,
    public readonly alias?: string,
  ) {
    super(field);
  }

  @Memoize()
  public get key(): string {
    return this.alias ?? this.field.name;
  }

  public mergeWith(
    ...selections: ReverseEdgeCountSelection[]
  ): ReverseEdgeCountSelection {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class ReverseEdgeCountField extends AbstractReferrerAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;
  public override readonly type: GraphQLOutputType;

  public constructor(node: NodeType, referrer: Referrer) {
    assert(!referrer.unique, `The "${referrer}" referrer is unique`);
    super(node, referrer);

    assert(!referrer.unique);
    this.name = referrer.name;
    this.description = referrer.description;
    this.type = GraphQLNonNull(Scalars.PositiveInt);
  }

  public override select(
    ast: FieldNode,
    path: Path,
    context: ASTContext,
  ): ReverseEdgeCountSelection {
    assertGraphQLFieldNodeWithoutSelectionSet(ast.selectionSet, path);

    return this.selection;
  }
}
