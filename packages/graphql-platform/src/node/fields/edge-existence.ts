import { Path } from '@prismamedia/graphql-platform-utils';
import { FieldNode, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { Node } from '../../node';
import { Edge } from '../component/edge';
import { Scalars } from '../component/leaf';
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

export interface IEdgeExistenceSelectionArgs {
  readonly filter?: TParsedWhereInputValue;
}

export interface IEdgeExistenceSelection
  extends IFieldSelection<'EdgeExistence'>,
    IFieldSelectionWithOptionalArgs<IEdgeExistenceSelectionArgs> {
  readonly edge: string;
}

export class EdgeExistenceField extends AbstractOutputField<
  undefined,
  boolean,
  IEdgeExistenceSelection
> {
  readonly #selection: IEdgeExistenceSelection = Object.freeze({
    kind: 'EdgeExistence',
    name: this.name,
    edge: this.edge.name,
  });

  public constructor(node: Node, public readonly edge: Edge) {
    super(node, `has${camelize(edge.name, false)}`, {
      description: `Either this "${node.name}" node has a(n) "${edge.name}" edge to a(n) "${edge.to.name}" node or not?`,
      public: edge.public,
      type: GraphQLNonNull(Scalars.Boolean),
    });
  }

  public parseFieldNode(field: FieldNode, path: Path): IEdgeExistenceSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    return this.#selection;
  }
}
