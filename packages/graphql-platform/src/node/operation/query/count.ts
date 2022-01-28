import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
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
} from '../../abstract-operation.js';
import type { NodeFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type CountQueryArgs = Nillable<{ where?: NodeFilterInputValue }>;

export type CountQueryResult = number;

export class CountQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  CountQueryArgs,
  CountQueryResult
> {
  protected override readonly selectionAware = false;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}Count`;
  public override readonly description = `Gets the number of "${this.node.plural}"`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(Scalars.UnsignedInt);
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<CountQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<CountQueryResult> {
    const argsPath = addPath(path, argsPathKey);

    const filter = this.node.filterInputType.filter(
      args?.where,
      context,
      addPath(argsPath, 'where'),
    ).normalized;

    if (filter?.isFalse()) {
      return 0;
    }

    return this.connector.count(
      {
        node: this.node,
        ...(filter && { where: filter }),
      },
      context,
    );
  }
}
