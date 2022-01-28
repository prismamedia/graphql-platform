import {
  NestableError,
  type Name,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { ReverseEdgeUniqueHeadSelection } from '../../../../../statement/selection/expression/reverse-edge/unique-head.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export class ReverseEdgeUniqueHeadOutputType extends AbstractReverseEdgeOutputType<undefined> {
  public override readonly name: Name;
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

  public override selectGraphQLField(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: Path,
  ): ReverseEdgeUniqueHeadSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

    this.parseGraphQLFieldArguments(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new NestableError(
        `${this.reverseEdge.head.indefinite}'s selection`,
        { path },
      );
    }

    return new ReverseEdgeUniqueHeadSelection(
      this.reverseEdge,
      this.reverseEdge.head.outputType.selectGraphQLSelectionSet(
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
    path: Path,
  ): ReverseEdgeUniqueHeadSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

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
