import { indefinite, Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLBoolean, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { Reference } from '../../../components';
import { NodeType } from '../../node';
import { ASTContext } from '../selection';
import { AbstractField, AbstractFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
} from './assertions';

export class EdgeExistenceFieldSelection extends AbstractFieldSelection<
  EdgeExistenceField,
  undefined,
  false
> {
  public constructor(field: EdgeExistenceField) {
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

export class EdgeExistenceField extends AbstractField<undefined, boolean> {
  public readonly selection = new EdgeExistenceFieldSelection(this);

  public constructor(node: NodeType, public readonly reference: Reference) {
    super(node, {
      name: `has${camelize(reference.name, false)}`,
      description: `Either this "${reference.model}" node has ${indefinite(
        reference.name,
        {
          quote: true,
        },
      )} edge heading to ${indefinite(reference.head.name, {
        quote: true,
      })} node or not?`,
      public: reference.public,
      type: GraphQLNonNull(GraphQLBoolean),
    });
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): EdgeExistenceFieldSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    return this.selection;
  }
}
