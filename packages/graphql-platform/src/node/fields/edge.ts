import {
  GraphQLNonNullDecorator,
  Path,
  UnexpectedNullValueError,
} from '@prismamedia/graphql-platform-utils';
import { FieldNode } from 'graphql';
import { INodeValue, Node } from '../../node';
import { Edge } from '../component/edge';
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

export interface IEdgeSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
}

export interface IEdgeSelection
  extends IFieldSelection<'Edge'>,
    IFieldSelectionWithSelections,
    IFieldSelectionWithOptionalArgs<IEdgeSelectionArgs> {}

export class EdgeField extends AbstractOutputField<
  undefined,
  null | INodeValue,
  IEdgeSelection
> {
  public constructor(node: Node, public readonly edge: Edge) {
    super(node, edge.name, {
      description: edge.description,
      public: edge.public,
      type: () => GraphQLNonNullDecorator(edge.to.type, !edge.nullable),
      assertValue(value: unknown, selection: IEdgeSelection, path: Path) {
        if (value === null) {
          if (!edge.nullable) {
            throw new UnexpectedNullValueError(
              `a(n) "${edge.to.name}" node`,
              path,
            );
          }

          return null;
        }

        return edge.to.assertNodeValue(value, selection.selections, path);
      },
    });
  }

  public parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): IEdgeSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    return {
      kind: 'Edge',
      name: this.name,
      selections: parseASTSelections(
        this.edge.to,
        field.selectionSet,
        path,
        context,
      ),
    };
  }
}
