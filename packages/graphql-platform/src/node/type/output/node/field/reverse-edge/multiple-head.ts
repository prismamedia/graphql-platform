import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import { argsPathKey } from '../../../../../abstract-operation.js';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { MultipleReverseEdgeHeadSelection } from '../../../../../statement/selection/expression/reverse-edge/multiple/head.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
} from '../../../../input.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export type MultipleReverseEdgeHeadOutputArgs = {
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  skip?: utils.Nillable<number>;
  first: number;
};

export class MultipleReverseEdgeHeadOutputType extends AbstractReverseEdgeOutputType<MultipleReverseEdgeHeadOutputArgs> {
  public readonly name: utils.Name;
  public readonly description?: string;
  public readonly deprecationReason?: string;

  public constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
  ) {
    super(reverseEdge);

    this.name = reverseEdge.name;
    this.description = reverseEdge.description;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  @Memoize()
  protected get arguments(): ReadonlyArray<utils.Input> {
    const defaults = this.reverseEdge.config.output?.defaultArgs;

    return [
      new utils.Input({
        name: 'where',
        type: this.reverseEdge.head.filterInputType,
        ...(defaults?.where !== undefined && { defaultValue: defaults.where }),
      }),
      new utils.Input({
        name: 'orderBy',
        type: new utils.ListableInputType(
          utils.nonNillableInputType(this.reverseEdge.head.orderingInputType),
        ),
        ...(defaults?.orderBy != null && { defaultValue: defaults.orderBy }),
      }),
      new utils.Input({
        name: 'skip',
        type: scalars.typesByName.UnsignedInt,
        ...(defaults?.skip != null && { defaultValue: defaults.skip }),
      }),
      new utils.Input({
        name: 'first',
        type: utils.nonNillableInputType(scalars.typesByName.UnsignedInt),
        ...(defaults?.first != null && { defaultValue: defaults.first }),
      }),
    ];
  }

  protected get type() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(
          this.reverseEdge.head.outputType.getGraphQLObjectType(),
        ),
      ),
    );
  }

  public selectGraphQLFieldNode(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: utils.Path,
  ): MultipleReverseEdgeHeadSelection {
    const args = this.parseGraphQLArgumentNodes(
      ast.arguments,
      selectionContext,
      path,
    );

    if (!ast.selectionSet) {
      throw new utils.GraphError(
        `${this.reverseEdge.head.indefinite}'s selection-set`,
        { path },
      );
    }

    const argsPath = utils.addPath(path, argsPathKey);

    return new MultipleReverseEdgeHeadSelection(
      this.reverseEdge,
      ast.alias?.value,
      this.reverseEdge.head.filterInputType.filter(
        args.where,
        operationContext,
        utils.addPath(argsPath, 'where'),
      ).normalized,
      this.reverseEdge.head.orderingInputType.sort(
        args.orderBy,
        operationContext,
        utils.addPath(argsPath, 'orderBy'),
      ).normalized,
      args.skip || undefined,
      args.first,
      this.reverseEdge.head.outputType.selectGraphQLSelectionSetNode(
        ast.selectionSet,
        operationContext,
        selectionContext,
        path,
      ),
    );
  }

  public selectShape(
    value: unknown,
    _operationContext: OperationContext | undefined,
    path: utils.Path,
  ): MultipleReverseEdgeHeadSelection {
    throw new utils.UnexpectedValueError('not to be selected', value, { path });
  }
}
