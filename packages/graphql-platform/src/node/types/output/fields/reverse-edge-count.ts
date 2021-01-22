import { addPath, Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLNonNull } from 'graphql';
import { singularize } from 'inflection';
import { pick } from 'lodash';
import { Node } from '../../../node';
import { Scalars } from '../../component';
import { TParsedWhereInputValue, TWhereNodeValue } from '../../input/where';
import { ReverseEdge } from '../../reverse-edge';
import { TASTContext } from '../../selection';
import {
  AbstractNodeOutputField,
  IFieldSelection,
  IFieldSelectionWithOptionalArgs,
} from './abstract';
import { assertGraphQLFieldNodeWithoutSelectionSet } from './common/assertions';
import { parseArgumentNodes } from './common/parse-argument-nodes';

export interface IReverseEdgeCountFieldArgs {
  readonly where?: TWhereNodeValue;
}

export interface IReverseEdgeCountSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
}

export interface IReverseEdgeCountSelection
  extends IFieldSelection<'ReverseEdgeCount'>,
    IFieldSelectionWithOptionalArgs<IReverseEdgeCountSelectionArgs> {
  readonly reverseEdge: string;
}

export class ReverseEdgeCountField extends AbstractNodeOutputField<
  IReverseEdgeCountFieldArgs,
  number,
  IReverseEdgeCountSelection
> {
  public readonly defaultArgs?: Readonly<Partial<IReverseEdgeCountFieldArgs>>;

  public constructor(node: Node, public readonly reverseEdge: ReverseEdge) {
    super(node, `${singularize(reverseEdge.name)}Count`, {
      description: `The number of "${reverseEdge.to.name}" nodes having a(n) "${reverseEdge.edge.name}" edge to this "${node.name}" node`,
      public: reverseEdge.public,
      args: () => ({
        where: {
          type: reverseEdge.to.whereInput.type,
          defaultValue: this.defaultArgs?.where,
        },
      }),
      type: GraphQLNonNull(Scalars.NonNegativeInt),
    });

    assert(!reverseEdge.unique);

    this.defaultArgs = pick(reverseEdge.config?.defaultArgs, 'where');
  }

  public parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): IReverseEdgeCountSelection {
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    const { where } = {
      ...this.defaultArgs,
      ...(field.arguments?.length &&
        parseArgumentNodes(field.arguments, context?.variableValues)),
    } as IReverseEdgeCountFieldArgs;

    return {
      kind: 'ReverseEdgeCount',
      name: this.name,
      reverseEdge: this.reverseEdge.name,
      ...(field.alias?.value && {
        alias: field.alias.value,
      }),
      ...(where && {
        args: {
          filter: this.reverseEdge.to.whereInput.parseValue(
            where,
            addPath(path, 'where'),
          ),
        },
      }),
    };
  }
}
