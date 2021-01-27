import { Path } from '@prismamedia/graphql-platform-utils';
import { strict as assert } from 'assert';
import { FieldNode, GraphQLOutputType } from 'graphql';
import { Referrer } from '../../../../referrer';
import { ASTContext, NodeSelection, NodeType } from '../../../node';
import { AbstractSelection } from '../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithSelectionSet,
  assertHomogeneousSelections,
} from '../assertions';
import { AbstractReferrerAwareField } from './abstract';

export class ReverseEdgeSelection extends AbstractSelection<ReverseEdgeField> {
  public constructor(
    field: ReverseEdgeField,
    public readonly head: NodeSelection,
  ) {
    super(field);
  }

  public mergeWith(
    ...selections: ReverseEdgeSelection[]
  ): ReverseEdgeSelection {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class ReverseEdgeField extends AbstractReferrerAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;

  public constructor(node: NodeType, referrer: Referrer) {
    assert(referrer.unique, `The "${referrer}" referrer is not unique`);
    super(node, referrer);

    this.name = referrer.name;
    this.description = referrer.description;
  }

  public override get type(): GraphQLOutputType {
    return this.referrer.originalReference.model.nodeType.type;
  }

  public override select(
    ast: FieldNode,
    path: Path,
    context: ASTContext,
  ): ReverseEdgeSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(ast.selectionSet, path);

    return new ReverseEdgeSelection(
      this,
      this.referrer.originalReference.model.nodeType.select(
        ast.selectionSet,
        path,
        context,
      ),
    );
  }
}
