import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { ReverseEdgeUniqueHeadSelection } from '../../../../../statement/selection/expression/reverse-edge/unique/head.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export class ReverseEdgeUniqueHeadOutputType extends AbstractReverseEdgeOutputType<undefined> {
  public override readonly name: utils.Name;
  public override readonly description?: string;
  public override readonly deprecationReason?: string;
  public override readonly arguments?: undefined;

  public constructor(public override readonly reverseEdge: ReverseEdgeUnique) {
    super(reverseEdge);

    this.name = reverseEdge.name;
    this.description = reverseEdge.description;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  public override get type() {
    return this.reverseEdge.head.outputType.getGraphQLObjectType();
  }

  public override selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): ReverseEdgeUniqueHeadSelection {
    this.parseGraphQLFieldArguments(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new utils.NestableError(
        `${this.reverseEdge.head.indefinite}'s selection-set`,
        { path },
      );
    }

    return new ReverseEdgeUniqueHeadSelection(
      this.reverseEdge,
      this.reverseEdge.head.outputType.selectGraphQLSelectionSetNode(
        ast.selectionSet,
        operationContext,
        selectionContext,
        path,
      ),
    );
  }

  public override selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: utils.Path,
  ): ReverseEdgeUniqueHeadSelection {
    return new ReverseEdgeUniqueHeadSelection(
      this.reverseEdge,
      value === null
        ? this.reverseEdge.head.identifier.selection
        : this.reverseEdge.head.outputType.selectShape(
            value,
            operationContext,
            path,
          ),
    );
  }
}
