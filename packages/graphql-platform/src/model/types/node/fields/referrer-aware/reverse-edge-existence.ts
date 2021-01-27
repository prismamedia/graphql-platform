import { indefiniteQuote, Path } from '@prismamedia/graphql-platform-utils';
import { strict as assert } from 'assert';
import {
  FieldNode,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { camelize } from 'inflection';
import { Referrer } from '../../../../referrer';
import { ASTContext, NodeType } from '../../../node';
import { AbstractSelection } from '../abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
  assertHomogeneousSelections,
} from '../assertions';
import { AbstractReferrerAwareField } from './abstract';

export class ReverseEdgeExistenceSelection extends AbstractSelection<ReverseEdgeExistenceField> {
  public mergeWith(...selections: ReverseEdgeExistenceSelection[]): this {
    assertHomogeneousSelections(this, selections);

    return this;
  }
}

export class ReverseEdgeExistenceField extends AbstractReferrerAwareField {
  public override readonly name: string;
  public override readonly description: string | undefined;
  public override readonly type: GraphQLOutputType;
  public readonly selection: ReverseEdgeExistenceSelection;

  public constructor(node: NodeType, referrer: Referrer) {
    assert(referrer.unique, `The "${referrer}" referrer is not unique`);
    super(node, referrer);

    this.name = `has${camelize(referrer.name, false)}`;
    this.description = `Either this "${
      referrer.model
    }" node has ${indefiniteQuote(
      referrer.name,
    )} edge heading to ${indefiniteQuote(referrer.model.name)} node or not?`;
    this.type = GraphQLNonNull(GraphQLBoolean);
    this.selection = new ReverseEdgeExistenceSelection(this);
  }

  public override select(
    ast: FieldNode,
    path: Path,
    _context: ASTContext,
  ): ReverseEdgeExistenceSelection {
    assertGraphQLFieldNodeWithoutArguments(ast.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(ast.selectionSet, path);

    return this.selection;
  }
}
