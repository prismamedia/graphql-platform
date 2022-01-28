import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  ListableInputType,
  nonNillableInputType,
  type Nillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type FindManyQueryArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  skip?: Nillable<number>;
  first: number;
}>;

export type FindManyQueryResult = NodeSelectedValue[];

export class FindManyQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  FindManyQueryArgs,
  FindManyQueryResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = inflection.camelize(this.node.plural, true);
  public override readonly description = `Retrieves a list of "${this.node.plural}"`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new Input({
        name: 'orderBy',
        type: new ListableInputType(
          nonNillableInputType(this.node.orderingInputType),
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
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(this.node.outputType.getGraphQLObjectType()),
      ),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<FindManyQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<FindManyQueryResult> {
    if (args.first === 0) {
      return [];
    }

    const argsPath = addPath(path, argsPathKey);

    const filter = this.node.filterInputType.filter(
      args.where,
      context,
      addPath(argsPath, 'where'),
    ).normalized;

    if (filter?.isFalse()) {
      return [];
    }

    const ordering = this.node.orderingInputType.sort(
      args.orderBy,
      context,
      addPath(argsPath, 'orderBy'),
    ).normalized;

    return this.connector.find(
      {
        node: this.node,
        ...(filter && { where: filter }),
        ...(ordering && { orderBy: ordering }),
        ...(args.skip && { offset: args.skip }),
        limit: args.first,
        selection: args.selection,
      },
      context,
    );
  }
}
