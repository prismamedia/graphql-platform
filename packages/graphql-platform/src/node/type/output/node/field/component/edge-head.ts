import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { Edge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import { EdgeHeadSelection } from '../../../../../statement.js';
import type { GraphQLSelectionContext, NodeOutputType } from '../../../node.js';
import { AbstractComponentOutputType } from '../abstract-component.js';

export class EdgeHeadOutputType extends AbstractComponentOutputType<undefined> {
  public readonly name: utils.Name;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public readonly args?: undefined;

  public constructor(
    parent: NodeOutputType,
    public readonly edge: Edge,
  ) {
    super(parent, edge);

    this.name = edge.name;
    this.description = edge.description;
    this.deprecationReason = edge.deprecationReason;
  }

  public get type() {
    return this.edge.isNullable()
      ? this.edge.head.outputType.getGraphQLObjectType()
      : new graphql.GraphQLNonNull(
          this.edge.head.outputType.getGraphQLObjectType(),
        );
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): EdgeHeadSelection {
    this.parseGraphQLArgumentNodes(ast.arguments, selectionContext, path);

    if (!ast.selectionSet) {
      throw new utils.GraphError(
        `Expects ${this.edge.head.indefinite}'s selection-set`,
        { path },
      );
    }

    const authorization = this.edge.isNullable()
      ? operationContext?.getAuthorization(this.edge.head)
      : operationContext?.ensureAuthorization(this.edge.head, path);

    const headSelection =
      this.edge.head.outputType.selectGraphQLSelectionSetNode(
        ast.selectionSet,
        operationContext,
        selectionContext,
        path,
      );

    return new EdgeHeadSelection(
      this.edge,
      ast.alias?.value,
      authorization,
      headSelection,
    );
  }

  public selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: utils.Path,
  ): EdgeHeadSelection {
    const authorization = this.edge.isNullable()
      ? operationContext?.getAuthorization(this.edge.head)
      : operationContext?.ensureAuthorization(this.edge.head, path);

    const headSelection =
      value === null
        ? this.edge.head.outputType.selectComponents(
            Array.from(this.edge.referencedUniqueConstraint.componentSet),
            operationContext,
            path,
          )
        : this.edge.head.outputType.selectShape(value, operationContext, path);

    return new EdgeHeadSelection(
      this.edge,
      undefined,
      authorization,
      headSelection,
    );
  }
}
