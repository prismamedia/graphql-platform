import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { UniqueReverseEdge } from '../../../../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { UniqueReverseEdgeHeadSelection } from '../../../../../statement/selection/expression/reverse-edge/unique/head.js';
import type { GraphQLSelectionContext, NodeOutputType } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export class UniqueReverseEdgeHeadOutputType extends AbstractReverseEdgeOutputType<undefined> {
  public readonly name: utils.Name;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public readonly args?: undefined;

  public constructor(
    parent: NodeOutputType,
    public override readonly reverseEdge: UniqueReverseEdge,
  ) {
    super(parent, reverseEdge);

    this.name = reverseEdge.name;
    this.description = reverseEdge.description;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  public get type() {
    return this.reverseEdge.head.outputType.getGraphQLObjectType();
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): UniqueReverseEdgeHeadSelection {
    this.parseGraphQLArgumentNodes(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new utils.GraphError(
        `${this.reverseEdge.head.indefinite}'s selection-set`,
        { path },
      );
    }

    const authorization = operationContext?.getAuthorization(
      this.reverseEdge.head,
    );

    const headSelection =
      this.reverseEdge.head.outputType.selectGraphQLSelectionSetNode(
        ast.selectionSet,
        operationContext,
        selectionContext,
        path,
      );

    return new UniqueReverseEdgeHeadSelection(
      this.reverseEdge,
      ast.alias?.value,
      authorization,
      headSelection,
    );
  }

  public selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: utils.Path,
  ): UniqueReverseEdgeHeadSelection {
    const headFilter = operationContext?.getAuthorization(
      this.reverseEdge.head,
    );

    const headSelection =
      value === null
        ? this.reverseEdge.head.mainIdentifier.selection
        : this.reverseEdge.head.outputType.selectShape(
            value,
            operationContext,
            path,
          );

    return new UniqueReverseEdgeHeadSelection(
      this.reverseEdge,
      undefined,
      headFilter,
      headSelection,
    );
  }
}
