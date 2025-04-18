import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
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
  ChangesSubscriptionCacheControlInputType,
  type ChangesSubscriptionCacheControlInputValue,
} from './changes/cache-control.js';
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
  forSubscription?: ChangesSubscriptionCacheControlInputValue;
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

  @MMethod()
  public override isEnabled(): boolean {
    return (
      super.isEnabled() &&
      this.node.uniqueConstraintSet
        .values()
        .some((uniqueConstraint) => uniqueConstraint.isScrollable())
    );
  }

  @MGetter
  public get orderingInputType() {
    return new ScrollSubscriptionOrderingInputType(this.node);
  }

  @MGetter
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
      new utils.Input({
        public: false,
        name: 'forSubscription',
        type: ChangesSubscriptionCacheControlInputType,
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

    const wherePath = utils.addPath(argsPath, 'where');
    const where = this.node.filterInputType.filter(
      args.where,
      context,
      wherePath,
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    const orderByPath = utils.addPath(argsPath, 'orderBy');
    const ordering = this.orderingInputType
      .getEnumValue(args.orderBy, orderByPath)
      .sort(context, orderByPath);

    return new ScrollSubscriptionStream(this.node, context, {
      filter,
      ordering,
      selection: args.selection,
      chunkSize: args.chunkSize!,
      forSubscription: args.forSubscription,
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
