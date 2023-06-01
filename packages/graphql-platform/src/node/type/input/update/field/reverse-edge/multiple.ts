import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import assert from 'node:assert/strict';
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

  // Non-destructive actions
  CREATE_SOME = 'create',
  CREATE_SOME_IF_NOT_EXISTS = 'createIfNotExists',
  UPDATE_ALL = 'updateAll',
  UPDATE_MANY = 'updateMany',
  UPDATE_SOME = 'update',
  UPDATE_SOME_IF_EXISTS = 'updateIfExists',
  UPSERT_SOME = 'upsert',
}

export type MultipleReverseEdgeUpdateInputValue = utils.Optional<
  Partial<{
    // Destructive actions
    [MultipleReverseEdgeUpdateInputAction.DELETE_ALL]: boolean;
    [MultipleReverseEdgeUpdateInputAction.DELETE_MANY]: NonNullable<NodeFilterInputValue>;
    [MultipleReverseEdgeUpdateInputAction.DELETE_SOME]: ReadonlyArray<
      NonNullable<NodeUniqueFilterInputValue>
    >;
    [MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS]: ReadonlyArray<
      NonNullable<NodeUniqueFilterInputValue>
    >;

    // Non-destructive actions
    [MultipleReverseEdgeUpdateInputAction.CREATE_SOME]: ReadonlyArray<
      NonNullable<NodeCreationInputValue>
    >;
    [MultipleReverseEdgeUpdateInputAction.CREATE_SOME_IF_NOT_EXISTS]: ReadonlyArray<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      data: NonNullable<NodeCreationInputValue>;
    }>;
    [MultipleReverseEdgeUpdateInputAction.UPDATE_ALL]: NonNullable<NodeUpdateInputValue>;
    [MultipleReverseEdgeUpdateInputAction.UPDATE_MANY]: NonNullable<{
      where?: NodeFilterInputValue;
      data?: NodeUpdateInputValue;
    }>;
    [MultipleReverseEdgeUpdateInputAction.UPDATE_SOME]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      data?: NodeUpdateInputValue;
    }>[];
    [MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      data?: NodeUpdateInputValue;
    }>[];
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
] satisfies MultipleReverseEdgeUpdateInputAction[];

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  MultipleReverseEdgeUpdateInputAction,
  DestructiveActionName
>;

export class MultipleReverseEdgeUpdateInput extends AbstractReverseEdgeUpdateInput<MultipleReverseEdgeUpdateInputValue> {
  public static supports(reverseEdge: MultipleReverseEdge): boolean {
    return (
      reverseEdge.head.isDeletable() ||
      reverseEdge.head.isCreatable() ||
      reverseEdge.head.isUpdatable(reverseEdge.originalEdge)
    );
  }

  public constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
  ) {
    assert(
      MultipleReverseEdgeUpdateInput.supports(reverseEdge),
      `The "${reverseEdge}" reverse-edge is not available at update`,
    );

    super(reverseEdge, {
      type: new utils.ObjectInputType({
        name: [
          reverseEdge.tail.name,
          inflection.camelize(utils.MutationType.UPDATE),
          reverseEdge.pascalCasedName,
          'Input',
        ].join(''),
        fields: () => {
          const fields: utils.Input[] = [];

          if (reverseEdge.head.isDeletable()) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.DELETE_ALL,
                type: scalars.typesByName.Boolean,
                nullable: false,
                public: reverseEdge.head.isPubliclyDeletable(),
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.DELETE_MANY,
                type: reverseEdge.head.filterInputType,
                nullable: false,
                public: reverseEdge.head.isPubliclyDeletable(),
              }),
            );

            if (
              reverseEdge.head.isPartiallyIdentifiableWithEdge(
                reverseEdge.originalEdge,
              )
            ) {
              fields.push(
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.DELETE_SOME,
                  type: new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      ),
                    ),
                  ),
                  nullable: false,
                  public: reverseEdge.head.isPubliclyDeletable(),
                }),
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS,
                  type: new utils.ListableInputType(
                    utils.nonNillableInputType(
                      reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      ),
                    ),
                  ),
                  nullable: false,
                  public: reverseEdge.head.isPubliclyDeletable(),
                }),
              );
            }
          }

          if (reverseEdge.head.isCreatable()) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.CREATE_SOME,
                type: new utils.ListableInputType(
                  utils.nonNillableInputType(
                    reverseEdge.head.getCreationWithoutEdgeInputType(
                      reverseEdge.originalEdge,
                    ),
                  ),
                ),
                nullable: false,
              }),
            );

            if (
              reverseEdge.head.isPartiallyIdentifiableWithEdge(
                reverseEdge.originalEdge,
              )
            ) {
              fields.push(
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.CREATE_SOME_IF_NOT_EXISTS,
                  type: new utils.ListableInputType(
                    utils.nonNillableInputType(
                      new utils.ObjectInputType({
                        name: [
                          reverseEdge.tail.name,
                          inflection.camelize(utils.MutationType.UPDATE),
                          reverseEdge.pascalCasedName,
                          inflection.camelize(
                            MultipleReverseEdgeUpdateInputAction.CREATE_SOME_IF_NOT_EXISTS,
                          ),
                          'Input',
                        ].join(''),
                        fields: () => [
                          new utils.Input({
                            name: 'where',
                            type: utils.nonNillableInputType(
                              reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                                reverseEdge.originalEdge,
                              ),
                            ),
                          }),
                          new utils.Input({
                            name: 'data',
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
                  nullable: false,
                }),
              );
            }
          }

          if (reverseEdge.head.isUpdatable(reverseEdge.originalEdge)) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.UPDATE_ALL,
                type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
              }),
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.UPDATE_MANY,
                type: new utils.ObjectInputType({
                  name: [
                    reverseEdge.tail.name,
                    inflection.camelize(utils.MutationType.UPDATE),
                    reverseEdge.pascalCasedName,
                    inflection.camelize(
                      MultipleReverseEdgeUpdateInputAction.UPDATE_MANY,
                    ),
                    'Input',
                  ].join(''),
                  fields: () => [
                    new utils.Input({
                      name: 'where',
                      type: reverseEdge.head.filterInputType,
                    }),
                    new utils.Input({
                      name: 'data',
                      type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      ),
                    }),
                  ],
                }),
                nullable: false,
                // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                public: reverseEdge.head.isPubliclyUpdatable(
                  reverseEdge.originalEdge,
                ),
              }),
            );

            if (
              reverseEdge.head.isPartiallyIdentifiableWithEdge(
                reverseEdge.originalEdge,
              )
            ) {
              fields.push(
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.UPDATE_SOME,
                  type: new utils.ListableInputType(
                    utils.nonNillableInputType(
                      new utils.ObjectInputType({
                        name: [
                          reverseEdge.tail.name,
                          inflection.camelize(utils.MutationType.UPDATE),
                          reverseEdge.pascalCasedName,
                          inflection.camelize(
                            MultipleReverseEdgeUpdateInputAction.UPDATE_SOME,
                          ),
                          'Input',
                        ].join(''),
                        fields: () => [
                          new utils.Input({
                            name: 'where',
                            type: utils.nonNillableInputType(
                              reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                                reverseEdge.originalEdge,
                              ),
                            ),
                          }),
                          new utils.Input({
                            name: 'data',
                            type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                              reverseEdge.originalEdge,
                            ),
                          }),
                        ],
                      }),
                    ),
                  ),
                  nullable: false,
                  // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                  public:
                    reverseEdge.head.isPubliclyPartiallyIdentifiableWithEdge(
                      reverseEdge.originalEdge,
                    ) &&
                    reverseEdge.head.isPubliclyUpdatable(
                      reverseEdge.originalEdge,
                    ),
                }),
                new utils.Input({
                  name: MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS,
                  type: new utils.ListableInputType(
                    utils.nonNillableInputType(
                      new utils.ObjectInputType({
                        name: [
                          reverseEdge.tail.name,
                          inflection.camelize(utils.MutationType.UPDATE),
                          reverseEdge.pascalCasedName,
                          inflection.camelize(
                            MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS,
                          ),
                          'Input',
                        ].join(''),
                        fields: () => [
                          new utils.Input({
                            name: 'where',
                            type: utils.nonNillableInputType(
                              reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                                reverseEdge.originalEdge,
                              ),
                            ),
                          }),
                          new utils.Input({
                            name: 'data',
                            type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                              reverseEdge.originalEdge,
                            ),
                          }),
                        ],
                      }),
                    ),
                  ),
                  nullable: false,
                  // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                  public:
                    reverseEdge.head.isPubliclyPartiallyIdentifiableWithEdge(
                      reverseEdge.originalEdge,
                    ) &&
                    reverseEdge.head.isPubliclyUpdatable(
                      reverseEdge.originalEdge,
                    ),
                }),
              );
            }
          }

          if (
            reverseEdge.head.isPartiallyIdentifiableWithEdge(
              reverseEdge.originalEdge,
            ) &&
            reverseEdge.head.isCreatable() &&
            reverseEdge.head.isUpdatable(reverseEdge.originalEdge)
          ) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeUpdateInputAction.UPSERT_SOME,
                type: new utils.ListableInputType(
                  utils.nonNillableInputType(
                    new utils.ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        inflection.camelize(utils.MutationType.UPDATE),
                        reverseEdge.pascalCasedName,
                        inflection.camelize(
                          MultipleReverseEdgeUpdateInputAction.UPSERT_SOME,
                        ),
                        'Input',
                      ].join(''),
                      fields: () => [
                        new utils.Input({
                          name: 'where',
                          type: utils.nonNillableInputType(
                            reverseEdge.head.getUniqueFilterWithoutEdgeInputType(
                              reverseEdge.originalEdge,
                            ),
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
                nullable: false,
                // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                public:
                  reverseEdge.head.isPubliclyPartiallyIdentifiableWithEdge(
                    reverseEdge.originalEdge,
                  ) &&
                  reverseEdge.head.isPubliclyCreatable(
                    reverseEdge.originalEdge,
                  ) &&
                  reverseEdge.head.isPubliclyUpdatable(
                    reverseEdge.originalEdge,
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
    nodeValues: ReadonlyArray<NodeValue>,
    inputValue: Readonly<NonNullable<MultipleReverseEdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void> {
    const selection = this.reverseEdge.head.identifier.selection;
    const originalEdge = this.reverseEdge.originalEdge;
    const originalEdgeName = originalEdge.name;
    const originalEdgeValues = nodeValues.map((nodeValue) =>
      originalEdge.referencedUniqueConstraint.parseValue(nodeValue),
    );

    // First, we apply destructive actions
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
                  context,
                  {
                    where: { [originalEdgeName]: { OR: originalEdgeValues } },
                    first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                    selection,
                  },
                  actionPath,
                );
            }
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_MANY: {
            const where = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('delete-many').execute(
              context,
              {
                where: {
                  AND: [
                    { [originalEdgeName]: { OR: originalEdgeValues } },
                    where,
                  ],
                },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                selection,
              },
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                Promise.all(
                  actionData.map((where, index) =>
                    this.reverseEdge.head
                      .getMutationByKey('delete-one')
                      .execute(
                        context,
                        {
                          where: {
                            ...where,
                            [originalEdgeName]: originalEdgeValue,
                          },
                          selection,
                        },
                        utils.addPath(actionPath, index),
                      ),
                  ),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('delete-many').execute(
              context,
              {
                where: {
                  AND: [
                    { [originalEdgeName]: { OR: originalEdgeValues } },
                    { OR: actionData },
                  ],
                },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                selection,
              },
              actionPath,
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
          case MultipleReverseEdgeUpdateInputAction.CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('create-some').execute(
              context,
              {
                data: originalEdgeValues.flatMap((originalEdgeValue) =>
                  actionData.map((data) => ({
                    ...data,
                    [originalEdgeName]: {
                      [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                    },
                  })),
                ),
                selection,
              },
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.CREATE_SOME_IF_NOT_EXISTS: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                Promise.all(
                  actionData.map(({ where, data }, index) =>
                    this.reverseEdge.head
                      .getMutationByKey('create-one-if-not-exists')
                      .execute(
                        context,
                        {
                          where: {
                            ...where,
                            [originalEdgeName]: originalEdgeValue,
                          },
                          data: {
                            ...data,
                            [originalEdgeName]: {
                              [EdgeUpdateInputAction.CONNECT]:
                                originalEdgeValue,
                            },
                          },
                          selection,
                        },
                        utils.addPath(actionPath, index),
                      ),
                  ),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPDATE_ALL: {
            const data = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              context,
              {
                where: { [originalEdgeName]: { OR: originalEdgeValues } },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                data,
                selection,
              },
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPDATE_MANY: {
            const { where, data } = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              context,
              {
                where: {
                  AND: [
                    { [originalEdgeName]: { OR: originalEdgeValues } },
                    where,
                  ],
                },
                first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
                data,
                selection,
              },
              actionPath,
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                Promise.all(
                  actionData.map(({ where, data }, index) =>
                    this.reverseEdge.head
                      .getMutationByKey('update-one')
                      .execute(
                        context,
                        {
                          where: {
                            ...where,
                            [originalEdgeName]: originalEdgeValue,
                          },
                          data,
                          selection,
                        },
                        utils.addPath(actionPath, index),
                      ),
                  ),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              actionData.map(({ where, data }, index) =>
                this.reverseEdge.head.getMutationByKey('update-many').execute(
                  context,
                  {
                    where: {
                      AND: [
                        { [originalEdgeName]: { OR: originalEdgeValues } },
                        where,
                      ],
                    },
                    first: originalEdgeValues.length,
                    data,
                    selection,
                  },
                  utils.addPath(actionPath, index),
                ),
              ),
            );
            break;
          }

          case MultipleReverseEdgeUpdateInputAction.UPSERT_SOME: {
            const actionData = inputValue[actionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                Promise.all(
                  actionData.map(({ where, create, update }, index) =>
                    this.reverseEdge.head.getMutationByKey('upsert').execute(
                      context,
                      {
                        where: {
                          ...where,
                          [originalEdgeName]: originalEdgeValue,
                        },
                        create: {
                          ...create,
                          [originalEdgeName]: {
                            [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                          },
                        },
                        update,
                        selection,
                      },
                      utils.addPath(actionPath, index),
                    ),
                  ),
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
