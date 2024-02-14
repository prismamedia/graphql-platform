import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { Leaf, LeafType } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import { LeafSelection } from '../../../../../statement.js';
import type { GraphQLSelectionContext, NodeOutputType } from '../../../node.js';
import { AbstractComponentOutputType } from '../abstract-component.js';

export class LeafOutputType extends AbstractComponentOutputType<undefined> {
  public readonly name: utils.Name;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public readonly args?: undefined;
  public readonly type: LeafType | graphql.GraphQLNonNull<LeafType>;

  public constructor(parent: NodeOutputType, public readonly leaf: Leaf) {
    super(parent, leaf);

    this.name = leaf.name;
    this.description = leaf.description;
    this.deprecationReason = leaf.deprecationReason;
    this.type = leaf.isNullable()
      ? leaf.type
      : new graphql.GraphQLNonNull(leaf.type);
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    _operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): LeafSelection {
    this.parseGraphQLArgumentNodes(ast.arguments, selectionContext, path);

    if (ast.selectionSet) {
      throw new utils.GraphError(`Expects no selection-set`, { path });
    }

    return new LeafSelection(this.leaf, ast.alias?.value);
  }

  public selectShape(
    _value: unknown,
    _operationContext: OperationContext | undefined,
    _path: utils.Path,
  ): LeafSelection {
    return this.leaf.selection;
  }
}
