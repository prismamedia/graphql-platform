import { Path } from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { FieldNode, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { Node } from '../../node';
import { Scalars } from '../component/leaf';
import { ReverseEdge } from '../reverse-edge';
import { TASTContext } from '../selection';
import { TParsedWhereInputValue } from '../where-input';
import {
  AbstractOutputField,
  IFieldSelection,
  IFieldSelectionWithOptionalArgs,
} from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
} from './common/assertions';

export interface IUniqueReverseEdgeExistenceSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
}

export interface IUniqueReverseEdgeExistenceSelection
  extends IFieldSelection<'UniqueReverseEdgeExistence'>,
    IFieldSelectionWithOptionalArgs<IUniqueReverseEdgeExistenceSelectionArgs> {
  readonly reverseEdge: string;
}

export class UniqueReverseEdgeExistenceField extends AbstractOutputField<
  undefined,
  boolean,
  IUniqueReverseEdgeExistenceSelection
> {
  readonly #selection: IUniqueReverseEdgeExistenceSelection = Object.freeze({
    kind: 'UniqueReverseEdgeExistence',
    name: this.name,
    reverseEdge: this.reverseEdge.name,
  });

  public constructor(node: Node, public readonly reverseEdge: ReverseEdge) {
    super(node, `has${camelize(reverseEdge.name, false)}`, {
      description: `Either this "${node.name}" node has a(n) "${reverseEdge.name}" edge to a(n) "${reverseEdge.to.name}" node or not?`,
      public: reverseEdge.public,
      type: GraphQLNonNull(Scalars.Boolean),
    });

    assert(reverseEdge.unique);
  }

  public parseFieldNode(
    field: FieldNode,
    path: Path,
    context?: TASTContext,
  ): IUniqueReverseEdgeExistenceSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    return this.#selection;
  }
}
