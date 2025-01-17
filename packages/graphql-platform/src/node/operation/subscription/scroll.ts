import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { NodeFilter, type NodeSelectedValue } from '../../statement.js';
import type { NodeFilterInputValue } from '../../type.js';
import { AbstractSubscription } from '../abstract-subscription.js';
import type { OperationContext } from '../context.js';
import {
  ScrollSubscriptionOrderingInputType,
  type ScrollSubscriptionOrderingInputValue,
} from './scroll/ordering-input-type.js';
import { ScrollSubscriptionStream } from './scroll/stream.js';

export * from './scroll/ordering-input-type.js';
export * from './scroll/stream.js';

export type ScrollSubscriptionArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: ScrollSubscriptionOrderingInputValue;
  chunkSize?: number;
}>;

export class ScrollSubscription<
  TRequestContext extends object,
> extends AbstractSubscription<
  ScrollSubscriptionArgs,
  ScrollSubscriptionStream<any, TRequestContext>,
  TRequestContext
> {
  protected readonly selectionAware = true;

  public readonly key = 'scroll' as const;
  public readonly method = 'scroll' as const;
  public readonly name = inflection.camelize(this.node.plural, true);
  public override readonly description = `Scroll the "${this.node.plural}"`;

  @Memoize()
  public override isEnabled(): boolean {
    return (
      super.isEnabled() &&
      this.node.uniqueConstraintSet
        .values()
        .some((uniqueConstraint) => uniqueConstraint.isScrollable())
    );
  }

  @Memoize()
  public get orderingInputType() {
    return new ScrollSubscriptionOrderingInputType(this.node);
  }

  @Memoize()
  public override get arguments() {
    const firstOrderingInputValue = this.orderingInputType.enumValues[0];

    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new utils.Input({
        name: 'orderBy',
        type: utils.nonNillableInputType(this.orderingInputType),
        defaultValue: firstOrderingInputValue.isPublic()
          ? firstOrderingInputValue.value
          : () => firstOrderingInputValue.value,
      }),
      new utils.Input({
        name: 'chunkSize',
        type: utils.nonNillableInputType(scalars.GraphQLUnsignedInt),
        defaultValue: 100,
        public: false,
      }),
    ];
  }

  protected executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<ScrollSubscriptionArgs>,
    path: utils.Path,
  ): ScrollSubscriptionStream {
    const argsPath = utils.addPath(path, argsPathKey);

    const where = this.node.filterInputType.filter(
      args.where,
      context,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    const ordering = this.orderingInputType.getEnumValue(args.orderBy).sort();

    return new ScrollSubscriptionStream(this.node, context, {
      filter,
      ordering,
      selection: args.selection,
      chunkSize: args.chunkSize!,
    });
  }

  public getGraphQLFieldConfigType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    NodeSelectedValue | null,
    TRequestContext,
    Omit<ScrollSubscriptionArgs, 'selection'>
  >['resolve'] {
    return (value) => value;
  }
}
