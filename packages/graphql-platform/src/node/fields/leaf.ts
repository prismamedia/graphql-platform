import {
  GraphQLNonNullDecorator,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { FieldNode } from 'graphql';
import { Node } from '../../node';
import { Leaf, TLeafValue } from '../component/leaf';
import { AbstractOutputField, IFieldSelection } from './abstract';
import {
  assertGraphQLFieldNodeWithoutArguments,
  assertGraphQLFieldNodeWithoutSelectionSet,
} from './common/assertions';

export interface ILeafSelection extends IFieldSelection<'Leaf'> {}

export class LeafField extends AbstractOutputField<
  undefined,
  TLeafValue,
  ILeafSelection
> {
  readonly #selection: ILeafSelection = Object.freeze({
    kind: 'Leaf',
    name: this.name,
  });

  public constructor(node: Node, public readonly leaf: Leaf) {
    super(node, leaf.name, {
      description: leaf.description,
      public: leaf.public,
      type: GraphQLNonNullDecorator(leaf.type, !leaf.nullable),
    });
  }

  public parseFieldNode(field: FieldNode, path: Path): ILeafSelection {
    assertGraphQLFieldNodeWithoutArguments(field.arguments, path);
    assertGraphQLFieldNodeWithoutSelectionSet(field.selectionSet, path);

    return this.#selection;
  }
}
