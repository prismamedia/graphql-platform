import { Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode } from 'graphql';
import { INodeValue, Node } from '../../node';
import { ReverseEdge } from '../reverse-edge';
import { parseASTSelections, TASTContext } from '../selection';
import { TParsedWhereInputValue } from '../where-input';
import {
  AbstractOutputField,
  IFieldSelection,
  IFieldSelectionWithOptionalArgs,
  IFieldSelectionWithSelections,
} from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithSelectionSet,
} from './common/assertions';

export interface IUniqueReverseEdgeSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
}

export interface IUniqueReverseEdgeSelection
  extends IFieldSelection<'UniqueReverseEdge'>,
    IFieldSelectionWithSelections,
    IFieldSelectionWithOptionalArgs<IUniqueReverseEdgeSelectionArgs> {}

export class UniqueReverseEdgeField extends AbstractOutputField<
  undefined,
  null | INodeValue,
  IUniqueReverseEdgeSelection
> {
  public constructor(node: Node, public readonly reverseEdge: ReverseEdge) {
    super(node, reverseEdge.name, {
      description: reverseEdge.description,
      public: reverseEdge.public,
      type: () => reverseEdge.to.type,
      assertValue: (
        value: unknown,
        selection: IUniqueReverseEdgeSelection,
        path: Path,
      ) =>
        value !== null
          ? reverseEdge.to.assertNodeValue(value, selection.selections, path)
          : null,
    });

    assert(reverseEdge.unique);
  }

  public parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): IUniqueReverseEdgeSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    return {
      kind: 'UniqueReverseEdge',
      name: this.name,
      selections: parseASTSelections(
        this.reverseEdge.to,
        field.selectionSet,
        path,
        context,
      ),
    };
  }
}
