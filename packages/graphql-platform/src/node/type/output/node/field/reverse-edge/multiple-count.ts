import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import { argsPathKey } from '../../../../../abstract-operation.js';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { ReverseEdgeMultipleCountSelection } from '../../../../../statement/selection/expression/reverse-edge/multiple/count.js';
import type { NodeFilterInputValue } from '../../../../input/filter.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export type ReverseEdgeMultipleCountOutputArgs = utils.Nillable<{
  where?: NodeFilterInputValue;
}>;

export class ReverseEdgeMultipleCountOutputType extends AbstractReverseEdgeOutputType<ReverseEdgeMultipleCountOutputArgs> {
  public override readonly name: utils.Name;
  public override readonly description?: string;
  public override readonly deprecationReason?: string;

  public constructor(
    public override readonly reverseEdge: ReverseEdgeMultiple,
  ) {
    super(reverseEdge);

    this.name = reverseEdge.countFieldName;
    this.description = `Number of "${reverseEdge.name}"`;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  @Memoize()
  public override get arguments(): ReadonlyArray<utils.Input> {
    return [
      new utils.Input({
        name: 'where',
        type: this.reverseEdge.head.filterInputType,
      }),
    ];
  }

  @Memoize()
  public override get type() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }

  public override selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): ReverseEdgeMultipleCountSelection {
    const args = this.parseGraphQLFieldArguments(
      ast.arguments,
      selectionContext,
      path,
    );

    if (ast.selectionSet) {
      throw new utils.NestableError(`Expects no selection-set`, { path });
    }

    const argsPath = utils.addPath(path, argsPathKey);

    return new ReverseEdgeMultipleCountSelection(
      this.reverseEdge,
      ast.alias?.value,
      this.reverseEdge.head.filterInputType.filter(
        args?.where,
        operationContext,
        utils.addPath(argsPath, 'where'),
      ).normalized,
    );
  }

  public override selectShape(
    value: unknown,
    _operationContext: OperationContext | undefined,
    path: utils.Path,
  ): ReverseEdgeMultipleCountSelection {
    throw new utils.UnexpectedValueError('not to be selected', value, { path });
  }
}
