import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import * as R from 'remeda';
import type { Merge } from 'type-fest';
import { argsPathKey } from '../../abstract-operation.js';
import { NodeFilter, NodeSelection } from '../../statement.js';
import type { NodeFilterInputValue, RawNodeSelection } from '../../type.js';
import { AbstractSubscription } from '../abstract-subscription.js';
import type { OperationContext } from '../context.js';
import { InvalidArgumentsError, InvalidSelectionError } from '../error.js';
import {
  ChangesSubscriptionDeletion,
  ChangesSubscriptionStream,
  type ChangesSubscriptionChange,
} from './changes/stream.js';

export * from './changes/stream.js';

const ChangeKindProperty = Symbol('ChangeKind');

enum ChangeKind {
  Deletion = 'DELETION',
  Upsert = 'UPSERT',
}

export type ChangesSubscriptionArgs = {
  where?: NodeFilterInputValue;
  selection:
    | graphql.GraphQLResolveInfo
    | {
        onUpsert: RawNodeSelection;
        onDeletion?: RawNodeSelection;
      };
};

export type ParsedChangesSubscriptionArgs = Merge<
  ChangesSubscriptionArgs,
  {
    selection: {
      onUpsert: NodeSelection;
      onDeletion?: NodeSelection;
    };
  }
>;

export class ChangesSubscription<
  TRequestContext extends object,
> extends AbstractSubscription<
  ChangesSubscriptionArgs,
  Promise<ChangesSubscriptionStream<TRequestContext>>,
  TRequestContext
> {
  protected readonly selectionAware = true;

  public readonly key = 'changes' as const;
  public readonly method = 'subscribeToChanges' as const;
  public readonly name = `${inflection.camelize(this.node.name, true)}Changes`;
  public override readonly description = `Subscribe to the "${this.node.plural}"' changes`;

  @MMethod()
  public override isEnabled(): boolean {
    return (
      super.isEnabled() &&
      utils.mutationTypes.some((mutationType) =>
        this.node.isMutable(mutationType),
      )
    );
  }

  @MMethod()
  public override isPublic(): boolean {
    return (
      super.isPublic() &&
      (!this.node.isDeletable() ||
        this.node.identifierSet
          .values()
          .some((identifier) => identifier.isPublic()))
    );
  }

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  public override parseArguments(
    context: OperationContext,
    args: ChangesSubscriptionArgs,
    path: utils.Path,
  ): ParsedChangesSubscriptionArgs {
    let parsedArgs;

    try {
      parsedArgs = utils.parseInputValues(
        this.arguments || [],
        utils.isPlainObject(args) ? R.omit(args, ['selection']) : args,
        utils.addPath(path, argsPathKey),
      );
    } catch (cause) {
      throw new InvalidArgumentsError({ cause, path });
    }

    try {
      const onUpsertPath = utils.addPath(path, 'onUpsert');
      const onDeletionPath = utils.addPath(path, 'onDeletion');

      const selection: Partial<ParsedChangesSubscriptionArgs['selection']> =
        utils.isGraphQLResolveInfo(args.selection)
          ? {
              onUpsert: args.selection.fieldNodes[0]?.selectionSet?.selections
                .filter(
                  (selection): selection is graphql.InlineFragmentNode =>
                    selection.kind === graphql.Kind.INLINE_FRAGMENT &&
                    selection.typeCondition?.name.value ===
                      this.node.outputType.name,
                )
                .reduce<NodeSelection | undefined>(
                  (maybeSelection, inlineFragment) => {
                    const selection =
                      this.node.outputType.selectGraphQLInlineFragmentNode(
                        inlineFragment,
                        context,
                        args.selection as graphql.GraphQLResolveInfo,
                        onUpsertPath,
                      );

                    return maybeSelection
                      ? maybeSelection.mergeWith(selection)
                      : selection;
                  },
                  undefined,
                ),
              onDeletion: args.selection.fieldNodes[0]?.selectionSet?.selections
                .filter(
                  (selection): selection is graphql.InlineFragmentNode =>
                    selection.kind === graphql.Kind.INLINE_FRAGMENT &&
                    selection.typeCondition?.name.value ===
                      this.node.deletionOutputType.name,
                )
                .reduce<NodeSelection | undefined>(
                  (maybeSelection, inlineFragment) => {
                    const selection =
                      this.node.outputType.selectGraphQLInlineFragmentNode(
                        inlineFragment,
                        context,
                        args.selection as graphql.GraphQLResolveInfo,
                        onDeletionPath,
                      );

                    return maybeSelection
                      ? maybeSelection.mergeWith(selection)
                      : selection;
                  },
                  undefined,
                ),
            }
          : {
              onUpsert: this.node.outputType.select(
                args.selection.onUpsert,
                context,
                undefined,
                onUpsertPath,
              ),
              ...(args.selection.onDeletion && {
                onDeletion: this.node.outputType.select(
                  args.selection.onDeletion,
                  context,
                  undefined,
                  onDeletionPath,
                ),
              }),
            };

      if (!selection.onUpsert) {
        throw new utils.GraphError(`Expects an "onUpsert" selection`, {
          path: onUpsertPath,
        });
      }

      if (selection.onDeletion) {
        if (!selection.onDeletion.isPure()) {
          throw new utils.GraphError(
            `Expects the "onDeletion" selection to be a subset of the "${this.node}"'s selection`,
            { path: onDeletionPath },
          );
        }

        if (!selection.onUpsert.isSupersetOf(selection.onDeletion)) {
          throw new utils.GraphError(
            `Expects the "onUpsert" selection to be a superset of the "onDeletion" selection`,
            { path: onDeletionPath },
          );
        }
      }

      Object.assign(parsedArgs, { selection });
    } catch (cause) {
      throw new InvalidSelectionError({ cause, path });
    }

    return parsedArgs as any;
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: ParsedChangesSubscriptionArgs,
    path: utils.Path,
  ): Promise<ChangesSubscriptionStream> {
    const argsPath = utils.addPath(path, argsPathKey);

    const where = this.node.filterInputType.filter(
      args.where,
      context,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    const stream = new ChangesSubscriptionStream(this.node, context, {
      filter,
      selection: args.selection,
    });
    await stream.subscribeToNodeChanges();

    return stream;
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLUnionType({
      name: `${this.node}Change`,
      description: `A single change in the "${this.name}"'s subscription, either a deletion (= "${this.node.deletionOutputType}") or an upsert (= "${this.node.outputType}")`,
      types: [
        this.node.deletionOutputType.getGraphQLObjectType(),
        this.node.outputType.getGraphQLObjectType(),
      ],
      resolveType: (change) =>
        change[ChangeKindProperty] === ChangeKind.Deletion
          ? this.node.deletionOutputType.name
          : this.node.outputType.name,
    } satisfies graphql.GraphQLUnionTypeConfig<
      { [ChangeKindProperty]: ChangeKind } & ChangesSubscriptionChange['value'],
      any
    >);
  }

  protected override getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    ChangesSubscriptionChange | null,
    TRequestContext,
    Omit<ChangesSubscriptionArgs, 'selection'>
  >['resolve'] {
    return (change) =>
      change
        ? change instanceof ChangesSubscriptionDeletion
          ? { [ChangeKindProperty]: ChangeKind.Deletion, ...change.value }
          : { [ChangeKindProperty]: ChangeKind.Upsert, ...change.value }
        : null;
  }
}
