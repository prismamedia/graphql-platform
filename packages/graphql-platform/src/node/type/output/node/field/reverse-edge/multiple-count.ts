import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  NestableError,
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
import { ReverseEdgeMultipleCountSelection } from '../../../../../statement/selection/expression/reverse-edge/multiple-count.js';
import type { NodeFilterInputValue } from '../../../../input/filter.js';
import type { GraphQLSelectionContext } from '../../../node.js';
import { AbstractReverseEdgeOutputType } from '../abstract-reverse-edge.js';

export type ReverseEdgeMultipleCountOutputArgs = Nillable<{
  where?: NodeFilterInputValue;
}>;

export class ReverseEdgeMultipleCountOutputType extends AbstractReverseEdgeOutputType<ReverseEdgeMultipleCountOutputArgs> {
  public override readonly name: Name;
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
  public override get arguments(): ReadonlyArray<Input> {
    return [
      new Input({
        name: 'where',
        type: this.reverseEdge.head.filterInputType,
      }),
    ];
  }

  @Memoize()
  public override get type() {
    return new graphql.GraphQLNonNull(Scalars.UnsignedInt);
  }

  public override selectGraphQLField(
    ast: graphql.FieldNode,
    operationContext: OperationContext | undefined,
    selectionContext: GraphQLSelectionContext | undefined,
    path: Path,
  ): ReverseEdgeMultipleCountSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

    const args = this.parseGraphQLFieldArguments(
      ast.arguments,
      selectionContext,
      path,
    );

    if (ast.selectionSet) {
      throw new NestableError(`Expects no selection-set`, { path });
    }

    const argsPath = addPath(path, argsPathKey);

    return new ReverseEdgeMultipleCountSelection(
      this.reverseEdge,
      ast.alias?.value,
      this.reverseEdge.head.filterInputType.filter(
        args?.where,
        operationContext,
        addPath(argsPath, 'where'),
      ),
    );
  }

  public override selectShape(
    value: unknown,
    operationContext: OperationContext | undefined,
    path: Path,
  ): ReverseEdgeMultipleCountSelection {
    operationContext?.getNodeAuthorization(this.reverseEdge.head, path);

    throw new UnexpectedValueError('not to be select', value, { path });
  }
}
