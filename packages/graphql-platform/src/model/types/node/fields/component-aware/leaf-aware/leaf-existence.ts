import { indefiniteQuote, Path } from '@prismamedia/graphql-platform-utils';
import { strict as assert } from 'assert';
import {
  FieldNode,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { camelize } from 'inflection';
import { Leaf } from '../../../../../components';
import { ASTContext, NodeType } from '../../../../node';
import { AbstractSelection } from '../../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
  assertHomogeneousSelections,
} from '../../assertions';
import { AbstractLeafAwareField } from './abstract';

export class LeafExistenceSelection extends AbstractSelection<LeafExistenceField> {
  public mergeWith(...selections: LeafExistenceSelection[]): this {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class LeafExistenceField extends AbstractLeafAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;
  public override readonly type: GraphQLOutputType;
  public readonly selection: LeafExistenceSelection;

  public constructor(node: NodeType, leaf: Leaf) {
    assert(leaf.nullable, `The "${leaf}" leaf is not nullable`);
    super(node, leaf);

    this.name = `has${camelize(leaf.name, false)}`;
    this.description = `Either this "${leaf.model}" node has ${indefiniteQuote(
      leaf.name,
    )} or not?`;
    this.type = GraphQLNonNull(GraphQLBoolean);
    this.selection = new LeafExistenceSelection(this);
  }

  public override select(
    ast: FieldNode,
    path: Path,
    _context: ASTContext,
  ): LeafExistenceSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(ast.selectionSet, path);

    return this.selection;
  }
}
