import { Name, NestableError, Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { Edge } from '../../../../../definition/component/edge.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { EdgeHeadSelection } from '../../../../../statement/selection/expression/component/edge-head.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractComponentOutputType } from '../abstract-component.js';

export class EdgeHeadOutputType extends AbstractComponentOutputType<undefined> {
  public override readonly name: Name;
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

  public override selectGraphQLField(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: Path,
  ): EdgeHeadSelection {
    operationContext?.getNodeAuthorization(this.edge.head, path);

    this.parseGraphQLFieldArguments(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new NestableError(
        `Expects ${this.edge.head.indefinite}'s selection`,
        { path },
      );
    }

    return new EdgeHeadSelection(
      this.edge,
      this.edge.head.outputType.selectGraphQLSelectionSet(
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
  ): EdgeHeadSelection {
    operationContext?.getNodeAuthorization(this.edge.head, path);

    return value === null
      ? this.edge.selection
      : new EdgeHeadSelection(
          this.edge,
          this.edge.head.outputType.selectShape(value, operationContext, path),
        );
  }
}
