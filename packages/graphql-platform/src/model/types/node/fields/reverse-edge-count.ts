import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  indefinite,
  Path,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLNonNull } from 'graphql';
import { singularize } from 'inflection';
import { isEqual } from 'lodash';
import { Referrer } from '../../../referrer';
import { FilterValue, WhereInputValue } from '../../inputs/where';
import { NodeType } from '../../node';
import { ASTContext } from '../selection';
import { AbstractField, AbstractFieldSelection } from './abstract';
import { assertGraphQLFieldNodeWithoutSelectionSet } from './assertions';
import { parseArgumentNodes } from './common/parse-argument-nodes';

export type ReverseEdgeCountFieldSelectionArgs =
  | { filter?: FilterValue }
  | undefined;

export class ReverseEdgeCountFieldSelection extends AbstractFieldSelection<
  ReverseEdgeCountField,
  ReverseEdgeCountFieldSelectionArgs,
  false
> {
  public constructor(
    field: ReverseEdgeCountField,
    alias?: string,
    args?: ReverseEdgeCountFieldSelectionArgs,
  ) {
    super(field, alias, args, undefined);
  }

  public mergeWith(
    ...fieldSelections: ReverseEdgeCountFieldSelection[]
  ): ReverseEdgeCountFieldSelection {
    fieldSelections.forEach((fieldSelection) => {
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
    });

    return this;
  }
}

export type ReverseEdgeCountFieldArgs = {
  where?: WhereInputValue;
};

export class ReverseEdgeCountField extends AbstractField<
  ReverseEdgeCountFieldArgs,
  number
> {
  public constructor(node: NodeType, public readonly reverseEdge: Referrer) {
    super(node, {
      name: `${singularize(reverseEdge.name)}Count`,
      description: `The number of "${
        reverseEdge.head
      }" nodes having ${indefinite(reverseEdge.reverse.name, {
        quote: true,
      })} edge heading to this "${reverseEdge.model}" node`,
      public: reverseEdge.public,
      args: () => ({
        where: {
          type: reverseEdge.head.whereInputType.type,
        },
      }),
      type: GraphQLNonNull(Scalars.PositiveInt),
    });

    assert(!reverseEdge.unique);
  }

  public select(
    field: FieldNode,
    path: Path,
    context?: ASTContext,
  ): ReverseEdgeCountFieldSelection {
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    const args: PlainObject = {
      ...(field.arguments?.length &&
        parseArgumentNodes(field.arguments, context?.variableValues)),
    };

    return new ReverseEdgeCountFieldSelection(
      this,
      field.alias?.value,
      args.where !== undefined
        ? {
            filter: this.reverseEdge.head.whereInputType.parseValue(
              args.where,
              addPath(path, 'where'),
            ),
          }
        : undefined,
    );
  }
}
