import {
  GraphQLNonNullDecorator,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode } from 'graphql';
import { Reference } from '../../../components';
import { NodeType } from '../../node';
import { ASTContext, NodeSelection } from '../selection';
import { NodeValue } from '../values';
import { AbstractField, AbstractFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithSelectionSet,
} from './assertions';

export class EdgeFieldSelection extends AbstractFieldSelection<
  EdgeField,
  undefined,
  true
> {
  public constructor(field: EdgeField, head: NodeSelection) {
    super(field, undefined, undefined, head);
  }

  public mergeWith(
    ...fieldSelections: EdgeFieldSelection[]
  ): EdgeFieldSelection {
    return fieldSelections.length === 0
      ? this
      : new EdgeFieldSelection(
          this.field,
          this.head.mergeWith(
            ...fieldSelections.map((fieldSelection) => {
              assert.strictEqual(fieldSelection.constructor, this.constructor);
              assert.strictEqual(fieldSelection.key, this.key);

              return fieldSelection.head;
            }),
          ),
        );
  }
}

export class EdgeField extends AbstractField<undefined, null | NodeValue> {
  public constructor(node: NodeType, public readonly reference: Reference) {
    super(node, {
      name: reference.name,
      description: reference.description,
      public: reference.public,
      type: () =>
        GraphQLNonNullDecorator(
          reference.head.nodeType.type,
          !reference.nullable,
        ),
      isValue(
        maybeValue: unknown,
        selection: EdgeFieldSelection,
      ): maybeValue is null | NodeValue {
        return maybeValue === null
          ? reference.nullable
          : reference.head.nodeType.isValue(maybeValue, selection.head);
      },
      assertValue(
        maybeValue: unknown,
        path: Path,
        selection: EdgeFieldSelection,
      ) {
        if (maybeValue === null) {
          if (!reference.nullable) {
            throw new UnexpectedValueError(
              maybeValue,
              `a non-null "${reference.head.nodeType.name}" node`,
              path,
            );
          }

          return null;
        }

        return reference.head.nodeType.assertValue(
          maybeValue,
          path,
          selection.head,
        );
      },
    });
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): EdgeFieldSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    return new EdgeFieldSelection(
      this,
      this.reference.head.nodeType.select(field.selectionSet, path, context),
    );
  }
}
