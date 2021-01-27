import { indefinite, Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLBoolean, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { Referrer } from '../../../referrer';
import { NodeType } from '../../node';
import { ASTContext } from '../selection';
import { AbstractField, AbstractFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
} from './assertions';

export class ReverseEdgeExistenceFieldSelection extends AbstractFieldSelection<
  ReverseEdgeExistenceField,
  undefined,
  false
> {
  public constructor(field: ReverseEdgeExistenceField) {
    super(field, undefined, undefined, undefined);
  }

  public mergeWith(...fieldSelections: this[]): this {
    fieldSelections.forEach((fieldSelection) => {
      assert.strictEqual(fieldSelection.constructor, this.constructor);
      assert.strictEqual(fieldSelection.key, this.key);
    });

    return this;
  }
}

export class ReverseEdgeExistenceField extends AbstractField<
  undefined,
  boolean
> {
  readonly #selection = new ReverseEdgeExistenceFieldSelection(this);

  public constructor(node: NodeType, public readonly reverseEdge: Referrer) {
    super(node, {
      name: `has${camelize(reverseEdge.name, false)}`,
      description: `Either this "${reverseEdge.model}" node has ${indefinite(
        reverseEdge.name,
        {
          quote: true,
        },
      )} edge heading to ${indefinite(reverseEdge.head.name, {
        quote: true,
      })} node or not?`,
      public: reverseEdge.public,
      type: GraphQLNonNull(GraphQLBoolean),
    });

    assert(reverseEdge.unique);
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): ReverseEdgeExistenceFieldSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    return this.#selection;
  }
}
