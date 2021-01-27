import { indefiniteQuote, Path } from '@prismamedia/graphql-platform-utils';
import { strict as assert } from 'assert';
import {
  FieldNode,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { camelize } from 'inflection';
import { Reference } from '../../../../../components';
import { ASTContext, NodeType } from '../../../../node';
import { AbstractSelection } from '../../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
  assertHomogeneousSelections,
} from '../../assertions';
import { AbstractReferenceAwareField } from './abstract';

export class EdgeExistenceSelection extends AbstractSelection<EdgeExistenceField> {
  public mergeWith(...selections: EdgeExistenceSelection[]): this {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class EdgeExistenceField extends AbstractReferenceAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;
  public override readonly type: GraphQLOutputType;
  public readonly selection: EdgeExistenceSelection;

  public constructor(node: NodeType, reference: Reference) {
    assert(reference.nullable, `The "${reference}" reference is not nullable`);
    super(node, reference);

    this.name = `has${camelize(reference.name, false)}`;
    this.description = `Either this "${
      reference.model
    }" node has ${indefiniteQuote(
      reference.name,
    )} edge heading to ${indefiniteQuote(
      reference.referencedUniqueConstraint.model.name,
    )} node or not?`;
    this.type = GraphQLNonNull(GraphQLBoolean);
    this.selection = new EdgeExistenceSelection(this);
  }

  public override select(
    ast: FieldNode,
    path: Path,
    _context: ASTContext,
  ): EdgeExistenceSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(ast.selectionSet, path);

    return this.selection;
  }
}
