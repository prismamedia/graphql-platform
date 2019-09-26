import {
  addPath,
  assertScalarValue,
  isIterable,
  parseArgumentNodes,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLList, GraphQLNonNull } from 'graphql';
import { INodeValue, Node } from '../../node';
import { Scalars } from '../component/leaf';
import {
  TOrderByInputValue,
  TParsedOrderByInputValue,
} from '../order-by-input';
import { ReverseEdge } from '../reverse-edge';
import { parseASTSelections, TASTContext } from '../selection';
import { TParsedWhereInputValue, TWhereInputValue } from '../where-input';
import {
  AbstractOutputField,
  IFieldSelection,
  IFieldSelectionWithRequiredArgs,
  IFieldSelectionWithSelections,
} from './abstract';
import { assertGraphQLFieldNodeWithSelectionSet } from './common/assertions';

export interface IReverseEdgeFieldArgs {
  readonly where?: TWhereInputValue;
  readonly orderBy?: TOrderByInputValue;
  readonly skip?: number;
  readonly first: number;
}

export interface IReverseEdgeSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
  readonly orderBy?: TParsedOrderByInputValue;
  readonly skip?: number;
  readonly first: number;
}

export interface IReverseEdgeSelection
  extends IFieldSelection<'ReverseEdge'>,
    IFieldSelectionWithSelections,
    IFieldSelectionWithRequiredArgs<IReverseEdgeSelectionArgs> {}

export class ReverseEdgeField extends AbstractOutputField<
  IReverseEdgeFieldArgs,
  INodeValue[],
  IReverseEdgeSelection
> {
  public readonly defaultArgs?: Readonly<Partial<IReverseEdgeFieldArgs>>;

  public constructor(node: Node, public readonly reverseEdge: ReverseEdge) {
    super(node, reverseEdge.name, {
      description: reverseEdge.description,
      public: reverseEdge.public,
      args: () => ({
        where: {
          type: this.reverseEdge.to.whereInput.type,
          defaultValue: this.defaultArgs?.where,
        },
        ...(this.reverseEdge.to.orderByInput.type && {
          orderBy: {
            type: GraphQLList(
              GraphQLNonNull(this.reverseEdge.to.orderByInput.type),
            ),
            defaultValue: this.defaultArgs?.orderBy,
          },
        }),
        skip: {
          type: Scalars.NonNegativeInt,
          defaultValue: this.defaultArgs?.skip,
        },
        first: {
          type: GraphQLNonNull(Scalars.NonNegativeInt),
          defaultValue: this.defaultArgs?.first,
        },
      }),
      type: () =>
        GraphQLNonNull(GraphQLList(GraphQLNonNull(reverseEdge.to.type))),
      assertValue(
        value: unknown,
        selection: IReverseEdgeSelection,
        path: Path,
      ) {
        if (!isIterable(value)) {
          throw new UnexpectedValueError(
            value,
            `a list of "${reverseEdge.to.name}" nodes`,
            path,
          );
        }

        return Array.from(value, (value, index) =>
          reverseEdge.to.assertNodeValue(
            value,
            selection.selections,
            addPath(path, index),
          ),
        );
      },
    });

    assert(!reverseEdge.unique);

    this.defaultArgs = reverseEdge.config?.defaultArgs;
  }

  public parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): IReverseEdgeSelection {
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    const { where, orderBy, skip, first } = {
      ...this.defaultArgs,
      ...(field.arguments?.length &&
        parseArgumentNodes(field.arguments, context?.variableValues)),
    } as IReverseEdgeFieldArgs;

    return <IReverseEdgeSelection>{
      kind: 'ReverseEdge',
      name: this.name,
      ...(field.alias?.value && {
        alias: field.alias.value,
      }),
      args: {
        ...(where && {
          filter: this.reverseEdge.to.whereInput.parseValue(
            where,
            addPath(path, 'where'),
          ),
        }),
        ...(orderBy?.length && {
          orderBy: this.reverseEdge.to.orderByInput.parseValue(
            orderBy,
            addPath(path, 'orderBy'),
          ),
        }),
        ...(skip !== undefined && {
          skip: assertScalarValue(
            Scalars.NonNegativeInt,
            skip,
            addPath(path, 'skip'),
          ),
        }),
        first: assertScalarValue(
          Scalars.NonNegativeInt,
          first,
          addPath(path, 'first'),
        ),
      },
      selections: parseASTSelections(
        this.reverseEdge.to,
        field.selectionSet,
        path,
        context,
      ),
    };
  }
}
