import { Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode } from 'graphql';
import { Referrer } from '../../../referrer';
import { NodeType } from '../../node';
import { ASTContext, NodeSelection } from '../selection';
import { NodeValue } from '../values';
import { AbstractField, AbstractFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithSelectionSet,
} from './assertions';

export class ReverseEdgeFieldSelection extends AbstractFieldSelection<
  ReverseEdgeField,
  undefined,
  true
> {
  public constructor(field: ReverseEdgeField, head: NodeSelection) {
    super(field, undefined, undefined, head);
  }

  public mergeWith(
    ...fieldSelections: ReverseEdgeFieldSelection[]
  ): ReverseEdgeFieldSelection {
    return fieldSelections.length === 0
      ? this
      : new ReverseEdgeFieldSelection(
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

export class ReverseEdgeField extends AbstractField<
  undefined,
  null | NodeValue
> {
  public constructor(node: NodeType, public readonly reverseEdge: Referrer) {
    super(node, {
      name: reverseEdge.name,
      description: reverseEdge.description,
      public: reverseEdge.public,
      type: () => reverseEdge.head.nodeType.type,
      isValue: (
        maybeValue: unknown,
        selection: ReverseEdgeFieldSelection,
      ): maybeValue is null | NodeValue =>
        maybeValue === null ||
        reverseEdge.head.nodeType.isValue(maybeValue, selection.head),
      assertValue: (
        maybeValue: unknown,
        path: Path,
        selection: ReverseEdgeFieldSelection,
      ) =>
        maybeValue === null
          ? null
          : reverseEdge.head.nodeType.assertValue(
              maybeValue,
              path,
              selection.head,
            ),
    });

    assert(reverseEdge.unique);
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): ReverseEdgeFieldSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    return new ReverseEdgeFieldSelection(
      this,
      this.reverseEdge.head.nodeType.select(field.selectionSet, path, context),
    );
  }
}
