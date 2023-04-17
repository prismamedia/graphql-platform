import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import type { IterableElement } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeFilterInputValue } from '../../../filter.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import type { NodeUpdateInputValue } from '../../../update.js';
import { AbstractReverseEdgeUpdateInput } from '../abstract-reverse-edge.js';
import { EdgeUpdateInputAction } from '../component/edge.js';

export enum MultipleReverseEdgeUpdateInputAction {
  // Destructive actions
  DELETE_ALL = 'deleteAll',
  DELETE_MANY = 'deleteMany',
  DELETE_SOME = 'delete',
  DELETE_SOME_IF_EXISTS = 'deleteIfExists',
  DISCONNECT_ALL = 'disconnectAll',
  DISCONNECT_MANY = 'disconnectMany',
  DISCONNECT_SOME = 'disconnect',
  DISCONNECT_SOME_IF_EXISTS = 'disconnectIfExists',

  // Non-destructive actions
  CONNECT_MANY = 'connectMany',
  CONNECT_OR_CREATE_SOME = 'connectOrCreate',
  CONNECT_SOME = 'connect',
  CONNECT_SOME_IF_EXISTS = 'connectIfExists',
  CREATE_SOME = 'create',
  UPSERT_SOME = 'upsert',
}

export type MultipleReverseEdgeUpdateInputValue = utils.Optional<
  Partial<{
    // Destructive actions
    [MultipleReverseEdgeUpdateInputAction.DELETE_ALL]: boolean;
    [MultipleReverseEdgeUpdateInputAction.DELETE_MANY]: NonNullable<NodeFilterInputValue>;
    [MultipleReverseEdgeUpdateInputAction.DELETE_SOME]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.DISCONNECT_ALL]: boolean;
    [MultipleReverseEdgeUpdateInputAction.DISCONNECT_MANY]: NonNullable<NodeFilterInputValue>;
    [MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>[];

    // Non-destructive actions
    [MultipleReverseEdgeUpdateInputAction.CONNECT_MANY]: NonNullable<NodeFilterInputValue>;
    [MultipleReverseEdgeUpdateInputAction.CONNECT_OR_CREATE_SOME]: NonNullable<{
      connect: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
    }>[];
    [MultipleReverseEdgeUpdateInputAction.CONNECT_SOME]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.CONNECT_SOME_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.CREATE_SOME]: NonNullable<NodeCreationInputValue>[];
    [MultipleReverseEdgeUpdateInputAction.UPSERT_SOME]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
      update?: NodeUpdateInputValue;
    }>[];
  }>
>;

const destructiveActionNames = [
  MultipleReverseEdgeUpdateInputAction.DELETE_ALL,
  MultipleReverseEdgeUpdateInputAction.DELETE_MANY,
  MultipleReverseEdgeUpdateInputAction.DELETE_SOME,
  MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS,
  MultipleReverseEdgeUpdateInputAction.DISCONNECT_ALL,
  MultipleReverseEdgeUpdateInputAction.DISCONNECT_MANY,
  MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME,
  MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME_IF_EXISTS,
] satisfies MultipleReverseEdgeUpdateInputAction[];

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  MultipleReverseEdgeUpdateInputAction,
  DestructiveActionName
>;

export class MultipleReverseEdgeUpdateInput extends AbstractReverseEdgeUpdateInput<MultipleReverseEdgeUpdateInputValue> {
  public constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
  ) {
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
                name: MultipleReverseEdgeUpdateInputAction.DELETE_ALL,
                type: new utils.NonNullableInputType(
                  scalars.typesByName.Boolean,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.DELETE_MANY,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.filterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.DELETE_SOME,
                type: new utils.NonNullableInputType(
                  new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS,
                type: new utils.NonNullableInputType(
                  new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
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
                  name: MultipleReverseEdgeUpdateInputAction.DISCONNECT_ALL,
                  type: new utils.NonNullableInputType(
                    scalars.typesByName.Boolean,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.DISCONNECT_MANY,
                  type: new utils.NonNullableInputType(
                    reverseEdge.head.filterInputType,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        reverseEdge.head.uniqueFilterInputType,
                      ),
                    ),
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME_IF_EXISTS,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        reverseEdge.head.uniqueFilterInputType,
                      ),
                    ),
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
              );
            }

            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.CONNECT_MANY,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.filterInputType,
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
                  name: MultipleReverseEdgeUpdateInputAction.CONNECT_OR_CREATE_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        new utils.ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              MultipleReverseEdgeUpdateInputAction.CONNECT_OR_CREATE_SOME,
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
                    ),
                  ),
                  public:
                    reverseEdge.head.isMutationPublic(
                      utils.MutationType.UPDATE,
                    ) &&
                    reverseEdge.head.isMutationPublic(
                      utils.MutationType.CREATION,
                    ),
                }),

                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.UPSERT_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        new utils.ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              MultipleReverseEdgeUpdateInputAction.UPSERT_SOME,
                            ),
                            reverseEdge.pascalCasedName,
                            'ReverseEdge',
                            inflection.camelize(utils.MutationType.UPDATE),
                            'Input',
                          ].join(''),
                          fields: () => [
                            new utils.Input({
                              name: 'where',
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
                            new utils.Input({
                              name: 'update',
                              type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                                reverseEdge.originalEdge,
                              ),
                            }),
                          ],
                        }),
                      ),
                    ),
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

            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.CONNECT_SOME,
                type: new utils.NonNullableInputType(
                  new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.CONNECT_SOME_IF_EXISTS,
                type: new utils.NonNullableInputType(
                  new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
            );
          }

          if (reverseEdge.head.isMutationEnabled(utils.MutationType.CREATION)) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.CREATE_SOME,
                type: new utils.NonNullableInputType(
                  new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.getCreationWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      ),
                    ),
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
    });
  }

  public override async applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNullable<MultipleReverseEdgeUpdateInputValue>>,
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

    // Apply destructive actions first
    await Promise.all(
      _.intersection<DestructiveActionName>(
        Object.keys(inputValue) as any,
        destructiveActionNames,
      ).map(async (actionName) => {
        const actionPath = utils.addPath(path, actionName);

        switch (actionName) {
          case MultipleReverseEdgeUpdateInputAction.DELETE_ALL: {
            const actionData = inputValue[actionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-many')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('delete-many').execute(
              {
                where: {
                  AND: [{ [originalEdgeName]: originalEdgeValue }, actionData],
                },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head.getMutationByKey('delete-one').execute(
                  {
                    where: { ...where, [originalEdgeName]: originalEdgeValue },
                    selection,
                  },
                  context,
                  utils.addPath(actionPath, index),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('delete-one-if-exists')
                  .execute(
                    {
                      where: {
                        ...where,
                        [originalEdgeName]: originalEdgeValue,
                      },
                      selection,
                    },
                    context,
                    utils.addPath(actionPath, index),
                  ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DISCONNECT_ALL: {
            const actionData = inputValue[actionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('update-many')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    data: { [originalEdgeName]: null },
                    first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DISCONNECT_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: {
                  AND: [{ [originalEdgeName]: originalEdgeValue }, actionData],
                },
                data: { [originalEdgeName]: null },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head.getMutationByKey('update-one').execute(
                  {
                    where: { ...where, [originalEdgeName]: originalEdgeValue },
                    data: { [originalEdgeName]: null },
                    selection,
                  },
                  context,
                  utils.addPath(actionPath, index),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DISCONNECT_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('update-one-if-exists')
                  .execute(
                    {
                      where: {
                        ...where,
                        [originalEdgeName]: originalEdgeValue,
                      },
                      data: { [originalEdgeName]: null },
                      selection,
                    },
                    context,
                    utils.addPath(actionPath, index),
                  ),
              ),
            );
            break;
          }

          default:
            throw new utils.UnreachableValueError(actionName, { path });
        }
      }),
    );

    // Then the others
    await Promise.all(
      _.difference<NonDestructiveActionName>(
        Object.keys(inputValue) as any,
        destructiveActionNames as any,
      ).map(async (actionName) => {
        const actionPath = utils.addPath(path, actionName);

        switch (actionName) {
          case MultipleReverseEdgeUpdateInputAction.CONNECT_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: actionData,
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
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

          case MultipleReverseEdgeUpdateInputAction.CONNECT_OR_CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map(({ connect, create }, index) =>
                this.reverseEdge.head.getMutationByKey('upsert').execute(
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
                  utils.addPath(actionPath, index),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.CONNECT_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head.getMutationByKey('update-one').execute(
                  {
                    where,
                    data: {
                      [originalEdgeName]: {
                        [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                      },
                    },
                    selection,
                  },
                  context,
                  utils.addPath(actionPath, index),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.CONNECT_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map((where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('update-one-if-exists')
                  .execute(
                    {
                      where,
                      data: {
                        [originalEdgeName]: {
                          [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                        },
                      },
                      selection,
                    },
                    context,
                    utils.addPath(actionPath, index),
                  ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('create-some').execute(
              {
                data: actionData.map((data) => ({
                  ...data,
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                  },
                })),
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPSERT_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map(({ where, create, update }) =>
                this.reverseEdge.head.getMutationByKey('upsert').execute(
                  {
                    where,
                    create: {
                      ...create,
                      [originalEdgeName]: {
                        [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                      },
                    },
                    update: {
                      ...update,
                      [originalEdgeName]: {
                        [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                      },
                    },
                    selection,
                  },
                  context,
                  actionPath,
                ),
              ),
            );
            break;
          }

          default:
            throw new utils.UnreachableValueError(actionName, { path });
        }
      }),
    );
  }
}
