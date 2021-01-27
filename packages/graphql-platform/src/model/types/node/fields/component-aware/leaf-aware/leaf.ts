import {
  GraphQLNonNullDecorator,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { FieldNode, GraphQLOutputType } from 'graphql';
import { Leaf } from '../../../../../components';
import { ASTContext, NodeType } from '../../../../node';
import { AbstractSelection } from '../../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
  assertHomogeneousSelections,
} from '../../assertions';
import { AbstractLeafAwareField } from './abstract';

export class LeafSelection extends AbstractSelection<LeafField> {
  public mergeWith(...selections: LeafSelection[]): this {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class LeafField extends AbstractLeafAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;
  public override readonly type: GraphQLOutputType;
  public readonly selection: LeafSelection;

  public constructor(node: NodeType, leaf: Leaf) {
    super(node, leaf);

    this.name = leaf.name;
    this.description = leaf.description;
    this.type = GraphQLNonNullDecorator(leaf.type, !leaf.nullable);
    this.selection = new LeafSelection(this);
  }

  public override select(
    ast: FieldNode,
    path: Path,
    _context: ASTContext,
  ): LeafSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(ast.selectionSet, path);

    return this.selection;
  }
}
