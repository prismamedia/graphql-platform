import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { Edge } from '../../../../../definition/component/edge.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { EdgeHeadSelection } from '../../../../../statement/selection/expression/component/edge/head.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractComponentOutputType } from '../abstract-component.js';

export class EdgeHeadOutputType extends AbstractComponentOutputType<undefined> {
  public override readonly name: utils.Name;
  public override readonly description?: string;
  public override readonly deprecationReason?: string;
  public override readonly arguments?: undefined;

  public constructor(public readonly edge: Edge) {
    super(edge);

    this.name = edge.name;
    this.description = edge.description;
    this.deprecationReason = edge.deprecationReason;
  }

  @Memoize()
  public override get type() {
    return this.edge.isNullable()
      ? this.edge.head.outputType.getGraphQLObjectType()
      : new graphql.GraphQLNonNull(
          this.edge.head.outputType.getGraphQLObjectType(),
        );
  }

  public override selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): EdgeHeadSelection {
    this.parseGraphQLArgumentNodes(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new utils.NestableError(
        `Expects ${this.edge.head.indefinite}'s selection-set`,
        { path },
      );
    }

    if (!this.edge.isNullable()) {
      operationContext?.ensureAuthorization(this.edge.head, path);
    }

    return new EdgeHeadSelection(
      this.edge,
      this.edge.head.outputType.selectGraphQLSelectionSetNode(
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
  ): EdgeHeadSelection {
    if (!this.edge.isNullable()) {
      operationContext?.ensureAuthorization(this.edge.head, path);
    }

    return value === null
      ? this.edge.selection
      : new EdgeHeadSelection(
          this.edge,
          this.edge.head.outputType.selectShape(value, operationContext, path),
        );
  }
}
