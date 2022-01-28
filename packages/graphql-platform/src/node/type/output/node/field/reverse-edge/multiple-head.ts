import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  ListableInputType,
  NestableError,
  nonNillableInputType,
  UnexpectedValueError,
  type Name,
  type Nillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import { argsPathKey } from '../../../../../abstract-operation.js';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import type { OperationContext } from '../../../../../operation/context.js';
import { ReverseEdgeMultipleHeadSelection } from '../../../../../statement/selection/expression/reverse-edge/multiple-head.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
} from '../../../../input.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export type ReverseEdgeMultipleHeadOutputArgs = {
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  skip?: Nillable<number>;
  first: number;
};

export class ReverseEdgeMultipleHeadOutputType extends AbstractReverseEdgeOutputType<ReverseEdgeMultipleHeadOutputArgs> {
  public override readonly name: Name;
  public override readonly description?: string;
  public override readonly deprecationReason?: string;

  public constructor(
    public override readonly reverseEdge: ReverseEdgeMultiple,
  ) {
    super(reverseEdge);

    this.name = reverseEdge.name;
    this.description = reverseEdge.description;
    this.deprecationReason = reverseEdge.deprecationReason;
  }

  @Memoize()
  public override get arguments(): ReadonlyArray<Input> {
    return [
      new Input({
        name: 'where',
        type: this.reverseEdge.head.filterInputType,
      }),
      new Input({
        name: 'orderBy',
        type: new ListableInputType(
          nonNillableInputType(this.reverseEdge.head.orderingInputType),
        ),
      }),
      new Input({
        name: 'skip',
        type: Scalars.UnsignedInt,
      }),
      new Input({
        name: 'first',
        type: nonNillableInputType(Scalars.UnsignedInt),
      }),
    ];
  }

  @Memoize()
  public override get type() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(
          this.reverseEdge.head.outputType.getGraphQLObjectType(),
        ),
      ),
    );
  }

  public override selectGraphQLField(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: Path,
  ): ReverseEdgeMultipleHeadSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

    const args = this.parseGraphQLFieldArguments(
      ast.arguments,
      selectionContext,
      path,
    );

    if (!ast.selectionSet) {
      throw new NestableError(
        `${this.reverseEdge.head.indefinite}'s selection`,
        { path },
      );
    }

    const argsPath = addPath(path, argsPathKey);

    return new ReverseEdgeMultipleHeadSelection(
      this.reverseEdge,
      ast.alias?.value,
      this.reverseEdge.head.filterInputType.filter(
        args.where,
        operationContext,
        addPath(argsPath, 'where'),
      ),
      this.reverseEdge.head.orderingInputType.sort(
        args.orderBy,
        operationContext,
        addPath(argsPath, 'orderBy'),
      ),
      args.skip || undefined,
      args.first,
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
  ): ReverseEdgeMultipleHeadSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

    throw new UnexpectedValueError('not to be select', value, { path });
  }
}
