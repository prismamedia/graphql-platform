import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type {
  Leaf,
  LeafType,
} from '../../../../../definition/component/leaf.js';
import type { OperationContext } from '../../../../../operation/context.js';
import type { LeafSelection } from '../../../../../statement/selection/expression/component/leaf.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractComponentOutputType } from '../abstract-component.js';

export class LeafOutputType extends AbstractComponentOutputType<undefined> {
  public override readonly name: utils.Name;
  public override readonly description?: string;
  public override readonly deprecationReason?: string;
  public override readonly arguments?: undefined;
  public override readonly type: LeafType | graphql.GraphQLNonNull<LeafType>;
  readonly #selection: LeafSelection;

  public constructor(public readonly leaf: Leaf) {
    super(leaf);

    this.name = leaf.name;
    this.description = leaf.description;
    this.deprecationReason = leaf.deprecationReason;
    this.type = leaf.isNullable()
      ? leaf.type
      : new graphql.GraphQLNonNull(leaf.type);
    this.#selection = leaf.selection;
  }

  public override selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    _operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): LeafSelection {
    this.parseGraphQLArgumentNodes(ast.arguments, selectionContext, path);

    if (ast.selectionSet) {
      throw new utils.NestableError(`Expects no selection-set`, { path });
    }

    return this.#selection;
  }

  public override selectShape(
    _value: unknown,
    _operationContext: OperationContext | undefined,
    _path: utils.Path,
  ): LeafSelection {
    return this.#selection;
  }
}
