import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { Merge } from 'type-fest';
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
  ScrollCursorInputType,
  type ScrollCursorInputValue,
} from './scroll/cursor.js';
import { ScrollSubscriptionStream } from './scroll/stream.js';

export * from './scroll/cursor.js';
export * from './scroll/stream.js';

export type ScrollSubscriptionArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  cursor?: ScrollCursorInputValue;
  forSubscription?: ChangesSubscriptionCacheControlInputValue;
}>;

type ParsedScrollSubscriptionArgs = Merge<
  ScrollSubscriptionArgs,
  { cursor: Required<ScrollCursorInputValue> }
>;

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
  public get cursorInputType() {
    return new ScrollCursorInputType(this.node);
  }

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new utils.Input({
        public: false,
        name: 'cursor',
        type: utils.nonNillableInputType(this.cursorInputType),
        defaultValue: {},
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
    args: NodeSelectionAwareArgs<ParsedScrollSubscriptionArgs>,
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

    const cursor = this.cursorInputType.createCursor(
      context,
      args.cursor,
      utils.addPath(argsPath, 'cursor'),
    );

    return new ScrollSubscriptionStream(this.node, context, {
      filter,
      cursor,
      selection: args.selection,
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
