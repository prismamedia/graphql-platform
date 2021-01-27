import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertScalarValue,
  isIterable,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLList, GraphQLNonNull } from 'graphql';
import { isEqual } from 'lodash';
import { Referrer } from '../../../referrer';
import { OrderByInputValue, SortValue } from '../../inputs/order-by';
import { FilterValue, WhereInputValue } from '../../inputs/where';
import { NodeType } from '../../node';
import { ASTContext, NodeSelection } from '../selection';
import { NodeValue } from '../values';
import { AbstractField, AbstractFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithArguments,
  assertGraphQLFieldNodeWithSelectionSet,
} from './assertions';
import { parseArgumentNodes } from './common/parse-argument-nodes';

export type ReverseEdgesFieldSelectionArgs = {
  filter?: FilterValue;
  sorts?: SortValue[];
  skip?: number;
  first: number;
};

export class ReverseEdgesFieldSelection extends AbstractFieldSelection<
  ReverseEdgesField,
  ReverseEdgesFieldSelectionArgs,
  true
> {
  public constructor(
    field: ReverseEdgesField,
    args: ReverseEdgesFieldSelectionArgs,
    head: NodeSelection,
    alias?: string,
  ) {
    super(field, alias, args, head);
  }

  public mergeWith(
    ...fieldSelections: ReverseEdgesFieldSelection[]
  ): ReverseEdgesFieldSelection {
    return fieldSelections.length === 0
      ? this
      : new ReverseEdgesFieldSelection(
          this.field,
          this.args,
          this.head.mergeWith(
            ...fieldSelections.map((fieldSelection) => {
              assert.strictEqual(fieldSelection.constructor, this.constructor);
              assert.strictEqual(fieldSelection.key, this.key);

              if (!isEqual(fieldSelection.args, this.args)) {
                throw new Error(
                  `The 2 field selections, keyed "${
                    this.key
                  }", have different arguments: ${JSON.stringify(
                    fieldSelection.args,
                  )} / ${JSON.stringify(this.args)}`,
                );
              }

              return fieldSelection.head;
            }),
          ),
          this.alias,
        );
  }
}

export type ReverseEdgesFieldArgs = {
  where?: WhereInputValue;
  orderBy?: OrderByInputValue;
  skip?: number;
  first: number;
};

export class ReverseEdgesField extends AbstractField<
  ReverseEdgesFieldArgs,
  NodeValue[]
> {
  public constructor(node: NodeType, public readonly reverseEdge: Referrer) {
    super(node, {
      name: reverseEdge.name,
      description: reverseEdge.description,
      public: reverseEdge.public,
      args: () => ({
        where: {
          type: this.reverseEdge.head.whereInputType.type,
        },
        ...(this.reverseEdge.head.orderByInputType.type && {
          orderBy: {
            type: this.reverseEdge.head.orderByInputType.type,
          },
        }),
        skip: {
          type: Scalars.PositiveInt,
        },
        first: {
          type: GraphQLNonNull(Scalars.PositiveInt),
        },
      }),
      type: () =>
        GraphQLNonNull(
          GraphQLList(GraphQLNonNull(reverseEdge.head.nodeType.type)),
        ),
      isValue(
        maybeValue: unknown,
        selection: ReverseEdgesFieldSelection,
      ): maybeValue is NodeValue[] {
        return (
          isIterable(maybeValue) &&
          [...maybeValue].every((value) =>
            reverseEdge.head.nodeType.isValue(value, selection.head),
          )
        );
      },
      assertValue(
        maybeValue: unknown,
        path: Path,
        selection: ReverseEdgesFieldSelection,
      ) {
        if (!isIterable(maybeValue)) {
          throw new UnexpectedValueError(
            maybeValue,
            `a list of "${reverseEdge.head.nodeType}" nodes`,
            path,
          );
        }

        return Array.from(maybeValue, (value, index) =>
          reverseEdge.head.nodeType.assertValue(
            value,
            addPath(path, index),
            selection.head,
          ),
        );
      },
    });

    assert(!reverseEdge.unique);
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): ReverseEdgesFieldSelection {
    assertGraphQLFieldNodeWithArguments(field.arguments, path);
    assertGraphQLFieldNodeWithSelectionSet(field.selectionSet, path);

    const args = parseArgumentNodes(field.arguments, context?.variableValues);

    return new ReverseEdgesFieldSelection(
      this,
      {
        ...(args?.where !== undefined && {
          filter: this.reverseEdge.head.whereInputType.parseValue(
            args.where,
            addPath(path, 'where'),
          ),
        }),
        ...(args?.orderBy && {
          sorts: this.reverseEdge.head.orderByInputType.parseValue(
            args.orderBy,
            addPath(path, 'orderBy'),
          ),
        }),
        ...(args?.skip !== undefined && {
          skip: assertScalarValue(
            Scalars.PositiveInt,
            args.skip,
            addPath(path, 'skip'),
          ),
        }),
        first: assertScalarValue(
          Scalars.PositiveInt,
          args?.first,
          addPath(path, 'first'),
        ),
      },
      this.reverseEdge.head.nodeType.select(field.selectionSet, path, context),
      field.alias?.value,
    );
  }
}
