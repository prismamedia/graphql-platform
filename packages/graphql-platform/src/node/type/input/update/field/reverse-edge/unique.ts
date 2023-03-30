import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import type { IterableElement } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractReverseEdgeUpdateInput } from '../abstract-reverse-edge.js';
import { EdgeUpdateInputAction } from '../component/edge.js';

export enum UniqueReverseEdgeUpdateInputAction {
  // Destructive actions
  DELETE = 'delete',
  DELETE_IF_EXISTS = 'deleteIfExists',
  DISCONNECT = 'disconnect',
  DISCONNECT_IF_EXISTS = 'disconnectIfExists',

  // Non-destructive actions
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
}

export type UniqueReverseEdgeUpdateInputValue = utils.Optional<
  Partial<{
    // Destructive actions
    [UniqueReverseEdgeUpdateInputAction.DELETE]: boolean;
    [UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS]: boolean;
    [UniqueReverseEdgeUpdateInputAction.DISCONNECT]: boolean;
    [UniqueReverseEdgeUpdateInputAction.DISCONNECT_IF_EXISTS]: boolean;

    // Non-destructive actions
    [UniqueReverseEdgeUpdateInputAction.CONNECT]: NonNullable<NodeUniqueFilterInputValue>;
    [UniqueReverseEdgeUpdateInputAction.CONNECT_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>;
    [UniqueReverseEdgeUpdateInputAction.CONNECT_OR_CREATE]: NonNullable<{
      connect: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
    }>;
    [UniqueReverseEdgeUpdateInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
  }>
>;

const destructiveActionNames = [
  UniqueReverseEdgeUpdateInputAction.DELETE,
  UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS,
  UniqueReverseEdgeUpdateInputAction.DISCONNECT,
  UniqueReverseEdgeUpdateInputAction.DISCONNECT_IF_EXISTS,
] as const;

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  UniqueReverseEdgeUpdateInputAction,
  DestructiveActionName
>;

const nonDestructiveActionNames = [
  UniqueReverseEdgeUpdateInputAction.CONNECT,
  UniqueReverseEdgeUpdateInputAction.CONNECT_IF_EXISTS,
  UniqueReverseEdgeUpdateInputAction.CONNECT_OR_CREATE,
  UniqueReverseEdgeUpdateInputAction.CREATE,
] as const;

export class UniqueReverseEdgeUpdateInput extends AbstractReverseEdgeUpdateInput<UniqueReverseEdgeUpdateInputValue> {
  public constructor(public override readonly reverseEdge: UniqueReverseEdge) {
    super(reverseEdge, {
      type: new utils.ObjectInputType({
        name: [
          reverseEdge.tail.name,
          'Nested',
          reverseEdge.pascalCasedName,
          'ReverseEdge',
          inflection.camelize(utils.MutationType.UPDATE),
          'Input',
        ].join(''),
        fields: () => {
          const fields: utils.Input[] = [];

          if (reverseEdge.head.isMutationEnabled(utils.MutationType.DELETION)) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.DELETE,
                type: new utils.NonNullableInputType(
                  scalars.typesByName.Boolean,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS,
                type: new utils.NonNullableInputType(
                  scalars.typesByName.Boolean,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
            );
          }

          if (
            reverseEdge.head.isMutationEnabled(utils.MutationType.UPDATE) &&
            reverseEdge.originalEdge.isMutable()
          ) {
            if (reverseEdge.originalEdge.isNullable()) {
              fields.push(
                new utils.Input({
                  name: UniqueReverseEdgeUpdateInputAction.DISCONNECT,
                  type: new utils.NonNullableInputType(
                    scalars.typesByName.Boolean,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: UniqueReverseEdgeUpdateInputAction.DISCONNECT_IF_EXISTS,
                  type: new utils.NonNullableInputType(
                    scalars.typesByName.Boolean,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
              );
            }

            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.CONNECT,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.CONNECT_IF_EXISTS,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
            );

            if (
              reverseEdge.head.isMutationEnabled(utils.MutationType.CREATION)
            ) {
              fields.push(
                new utils.Input({
                  name: UniqueReverseEdgeUpdateInputAction.CONNECT_OR_CREATE,
                  type: new utils.NonNullableInputType(
                    new utils.ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        'Nested',
                        inflection.camelize(
                          UniqueReverseEdgeUpdateInputAction.CONNECT_OR_CREATE,
                        ),
                        reverseEdge.pascalCasedName,
                        'ReverseEdge',
                        inflection.camelize(utils.MutationType.UPDATE),
                        'Input',
                      ].join(''),
                      fields: () => [
                        new utils.Input({
                          name: 'connect',
                          type: utils.nonNillableInputType(
                            reverseEdge.head.uniqueFilterInputType,
                          ),
                        }),
                        new utils.Input({
                          name: 'create',
                          type: utils.nonNillableInputType(
                            reverseEdge.head.getCreationWithoutEdgeInputType(
                              reverseEdge.originalEdge,
                            ),
                          ),
                        }),
                      ],
                    }),
                  ),
                  public:
                    reverseEdge.head.isMutationPublic(
                      utils.MutationType.UPDATE,
                    ) &&
                    reverseEdge.head.isMutationPublic(
                      utils.MutationType.CREATION,
                    ),
                }),
              );
            }
          }

          if (reverseEdge.head.isMutationEnabled(utils.MutationType.CREATION)) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.CREATE,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.getCreationWithoutEdgeInputType(
                    reverseEdge.originalEdge,
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.CREATION,
                ),
              }),
            );
          }

          return fields;
        },
      }),
      parser(inputValue, path) {
        const inputActionNames = Object.keys(
          inputValue,
        ) as UniqueReverseEdgeUpdateInputAction[];

        if (
          _.intersection(inputActionNames, destructiveActionNames).length > 1
        ) {
          throw new utils.UnexpectedValueError(
            `no more than one destructive action among ${destructiveActionNames.join(
              ', ',
            )}`,
            inputValue,
            { path },
          );
        }

        if (
          _.intersection(inputActionNames, nonDestructiveActionNames).length > 1
        ) {
          throw new utils.UnexpectedValueError(
            `no more than one action among ${nonDestructiveActionNames.join(
              ', ',
            )}`,
            inputValue,
            { path },
          );
        }

        return inputValue;
      },
    });
  }

  public override async applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNullable<UniqueReverseEdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void> {
    const originalEdgeName = this.reverseEdge.originalEdge.name;
    const originalEdgeValue =
      this.reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
        nodeValue,
        path,
      );
    const selection = this.reverseEdge.head.identifier.selection;

    const inputActionNames = Object.keys(
      inputValue,
    ) as UniqueReverseEdgeUpdateInputAction[];

    // Apply destructive action first
    {
      const maybeActionName = inputActionNames.find(
        (actionName): actionName is DestructiveActionName =>
          destructiveActionNames.includes(actionName as any),
      );

      if (maybeActionName) {
        const actionPath = utils.addPath(path, maybeActionName);

        switch (maybeActionName) {
          case UniqueReverseEdgeUpdateInputAction.DELETE: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-one')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-one-if-exists')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.DISCONNECT: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('update-one')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    data: { [originalEdgeName]: null },
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.DISCONNECT_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('update-one-if-exists')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    data: { [originalEdgeName]: null },
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          default:
            throw new utils.UnreachableValueError(maybeActionName, { path });
        }
      }
    }

    // Then the other
    {
      const maybeActionName = inputActionNames.find(
        (actionName): actionName is NonDestructiveActionName =>
          nonDestructiveActionNames.includes(actionName as any),
      );

      if (maybeActionName) {
        const actionPath = utils.addPath(path, maybeActionName);

        switch (maybeActionName) {
          case UniqueReverseEdgeUpdateInputAction.CONNECT: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutationByKey('update-one').execute(
              {
                where: actionData,
                data: {
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                  },
                },
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.CONNECT_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head
              .getMutationByKey('update-one-if-exists')
              .execute(
                {
                  where: actionData,
                  data: {
                    [originalEdgeName]: {
                      [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                    },
                  },
                  selection,
                },
                context,
                actionPath,
              );
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.CONNECT_OR_CREATE: {
            const { connect, create } = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutationByKey('upsert').execute(
              {
                where: connect,
                create: {
                  ...create,
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                  },
                },
                update: {
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                  },
                },
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.CREATE: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutationByKey('create-one').execute(
              {
                data: {
                  ...actionData,
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                  },
                },
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          default:
            throw new utils.UnreachableValueError(maybeActionName, { path });
        }
      }
    }
  }
}
