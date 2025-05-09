import * as opentelemetry from '@opentelemetry/api';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { CamelCase } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import { trace } from '../../instrumentation.js';
import { AbstractOperation } from '../abstract-operation.js';
import { OperationContext } from './context.js';

export abstract class AbstractQuery<
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends AbstractOperation<
  TArgs,
  Promise<TResult>,
  TRequestContext,
  TConnector,
  TBroker,
  TContainer,
  OperationContext<TRequestContext, TConnector, TBroker, TContainer>
> {
  public readonly operationType = graphql.OperationTypeNode.QUERY;

  @MGetter
  public get method(): CamelCase<this['key']> {
    return this.key.replaceAll(/((?:-).)/g, ([_match, letter]) =>
      letter.toUpperCase(),
    ) as any;
  }

  public override async execute(
    context: TRequestContext | OperationContext,
    args: TArgs,
    path?: utils.Path,
  ): Promise<TResult> {
    const name: string = `operation.${this.node}.${this.operationType}.${this.key}`;
    const attributes: opentelemetry.Attributes = {
      'operation.node': this.node.name,
      'operation.type': this.operationType,
      'operation.key': this.key,
    };

    return context instanceof OperationContext
      ? trace(name, () => super.execute(context, args, path), { attributes })
      : trace(
          name,
          () =>
            this.gp.withOperationContext(
              context,
              (context) => super.execute(context, args, path),
              path,
            ),
          { kind: opentelemetry.SpanKind.SERVER, attributes },
        );
  }

  protected getGraphQLFieldConfigSubscriber(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['subscribe'] {
    return undefined;
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return (_, args, context, info) =>
      utils
        .PromiseTry(
          this.execute.bind(
            this,
            context,
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            info.path,
          ),
        )
        .catch((error) => {
          throw utils.isGraphError(error) ? error.toGraphQLError() : error;
        });
  }
}
