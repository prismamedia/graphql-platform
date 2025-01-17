import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { argsPathKey } from '../../../../../abstract-operation.js';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { MultipleReverseEdgeCountSelection } from '../../../../../statement/selection/expression/reverse-edge/multiple/count.js';
import type { NodeFilterInputValue } from '../../../../input/filter.js';
import type { GraphQLSelectionContext, NodeOutputType } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export type MultipleReverseEdgeCountOutputArgs = utils.Nillable<{
  where?: NodeFilterInputValue;
}>;

export class MultipleReverseEdgeCountOutputType extends AbstractReverseEdgeOutputType<MultipleReverseEdgeCountOutputArgs> {
  public readonly name: utils.Name;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public constructor(
    parent: NodeOutputType,
    public override readonly reverseEdge: MultipleReverseEdge,
  ) {
    super(parent, reverseEdge);

    this.name = reverseEdge.countFieldName;
    this.description = `Number of "${reverseEdge.name}"`;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  @MGetter
  public get args(): ReadonlyArray<utils.Input> {
    const defaults = this.reverseEdge.config.output?.defaultArgs;

    return [
      new utils.Input({
        name: 'where',
        type: this.reverseEdge.head.filterInputType,
        ...(defaults?.where !== undefined && { defaultValue: defaults.where }),
      }),
    ];
  }

  public get type() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): MultipleReverseEdgeCountSelection {
    const args = this.parseGraphQLArgumentNodes(
      ast.arguments,
      selectionContext,
      path,
    );

    if (ast.selectionSet) {
      throw new utils.GraphError(`Expects no selection-set`, { path });
    }

    const argsPath = utils.addPath(path, argsPathKey);

    const headFilter = this.reverseEdge.head.filterInputType.filter(
      args?.where,
      operationContext,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    return new MultipleReverseEdgeCountSelection(
      this.reverseEdge,
      ast.alias?.value,
      headFilter,
    );
  }

  public selectShape(
    value: unknown,
    _operationContext: OperationContext | undefined,
    path: utils.Path,
  ): MultipleReverseEdgeCountSelection {
    throw new utils.UnexpectedValueError('not to be selected', value, { path });
  }
}
