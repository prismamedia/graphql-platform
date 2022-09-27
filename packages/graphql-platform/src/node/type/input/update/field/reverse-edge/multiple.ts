import { Scalars } from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import type { IterableElement } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeFilterInputValue } from '../../../filter.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractReverseEdgeUpdateInput } from '../abstract-reverse-edge.js';
import { EdgeUpdateInputAction } from '../component/edge.js';

export enum ReverseEdgeMultipleUpdateInputAction {
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
}

export type ReverseEdgeMultipleUpdateInputValue = utils.Optional<
  Partial<{
    // Destructive actions
    [ReverseEdgeMultipleUpdateInputAction.DELETE_ALL]: boolean;
    [ReverseEdgeMultipleUpdateInputAction.DELETE_MANY]: utils.NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.DELETE_SOME]: utils.NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL]: boolean;
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY]: utils.NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME]: utils.NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>[];

    // Non-destructive actions
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY]: utils.NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME]: utils.NonNillable<{
      where: utils.NonNillable<NodeUniqueFilterInputValue>;
      create: utils.NonNillable<NodeCreationInputValue>;
    }>[];
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME]: utils.NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.CREATE_SOME]: utils.NonNillable<NodeCreationInputValue>[];
  }>
>;

const destructiveActionNames = [
  ReverseEdgeMultipleUpdateInputAction.DELETE_ALL,
  ReverseEdgeMultipleUpdateInputAction.DELETE_MANY,
  ReverseEdgeMultipleUpdateInputAction.DELETE_SOME,
  ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS,
  ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL,
  ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY,
  ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME,
  ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS,
] as const;

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  ReverseEdgeMultipleUpdateInputAction,
  DestructiveActionName
>;

export class ReverseEdgeMultipleUpdateInput extends AbstractReverseEdgeUpdateInput<ReverseEdgeMultipleUpdateInputValue> {
  public constructor(
    public override readonly reverseEdge: ReverseEdgeMultiple,
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
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_ALL,
                type: new utils.NonNullableInputType(Scalars.Boolean),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_MANY,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.filterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.DELETION,
                ),
              }),
              new utils.Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_SOME,
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
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS,
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
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL,
                  type: new utils.NonNullableInputType(Scalars.Boolean),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY,
                  type: new utils.NonNullableInputType(
                    reverseEdge.head.filterInputType,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    utils.MutationType.UPDATE,
                  ),
                }),
                new utils.Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME,
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
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS,
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
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY,
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
                  name: ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        new utils.ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME,
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
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME,
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
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS,
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
                name: ReverseEdgeMultipleUpdateInputAction.CREATE_SOME,
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
    inputValue: Readonly<
      utils.NonNillable<ReverseEdgeMultipleUpdateInputValue>
    >,
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
          case ReverseEdgeMultipleUpdateInputAction.DELETE_ALL: {
            const actionData = inputValue[actionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-many')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    first: 1_000_000,
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DELETE_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('delete-many').execute(
              {
                where: {
                  AND: [{ [originalEdgeName]: originalEdgeValue }, actionData],
                },
                first: 1_000_000,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DELETE_SOME: {
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

          case ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS: {
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

          case ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL: {
            const actionData = inputValue[actionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('update-many')
                .execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    data: { [originalEdgeName]: null },
                    first: 1_000_000,
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: {
                  AND: [{ [originalEdgeName]: originalEdgeValue }, actionData],
                },
                data: { [originalEdgeName]: null },
                first: 1_000_000,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME: {
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

          case ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS: {
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
          case ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: actionData,
                first: 1_000_000,
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

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map(({ where, create }, index) =>
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

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME: {
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

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS: {
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

          case ReverseEdgeMultipleUpdateInputAction.CREATE_SOME: {
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

          default:
            throw new utils.UnreachableValueError(actionName, { path });
        }
      }),
    );
  }
}
