import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import assert from 'node:assert';
import * as R from 'remeda';
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

const multipleReverseEdgeUpdateInputActions = utils.getEnumValues(
  MultipleReverseEdgeUpdateInputAction,
);

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
    [MultipleReverseEdgeUpdateInputAction.UPDATE_MANY]: ReadonlyArray<
      NonNullable<{
        where?: NodeFilterInputValue;
        data?: NodeUpdateInputValue;
      }>
    >;
    [MultipleReverseEdgeUpdateInputAction.UPDATE_SOME]: ReadonlyArray<
      NonNullable<{
        where: NonNullable<NodeUniqueFilterInputValue>;
        data?: NodeUpdateInputValue;
      }>
    >;
    [MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS]: ReadonlyArray<
      NonNullable<{
        where: NonNullable<NodeUniqueFilterInputValue>;
        data?: NodeUpdateInputValue;
      }>
    >;
    [MultipleReverseEdgeUpdateInputAction.UPSERT_SOME]: ReadonlyArray<
      NonNullable<{
        where: NonNullable<NodeUniqueFilterInputValue>;
        create: NonNullable<NodeCreationInputValue>;
        update?: NodeUpdateInputValue;
      }>
    >;
  }>
>;

const destructiveActionNames = [
  MultipleReverseEdgeUpdateInputAction.DELETE_ALL,
  MultipleReverseEdgeUpdateInputAction.DELETE_MANY,
  MultipleReverseEdgeUpdateInputAction.DELETE_SOME,
  MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS,
] satisfies MultipleReverseEdgeUpdateInputAction[];

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

const isDestructiveActionName = (
  maybeDestructiveActionName: unknown,
): maybeDestructiveActionName is DestructiveActionName =>
  destructiveActionNames.includes(maybeDestructiveActionName as any);

type NonDestructiveActionName = Exclude<
  MultipleReverseEdgeUpdateInputAction,
  DestructiveActionName
>;

const isNonDestructiveActionName = (
  maybeNonDestructiveActionName: unknown,
): maybeNonDestructiveActionName is NonDestructiveActionName =>
  !isDestructiveActionName(maybeNonDestructiveActionName);

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
              reverseEdge.head.isPartiallyIdentifiableByEdge(
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
              reverseEdge.head.isPartiallyIdentifiableByEdge(
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
                type: new utils.ListableInputType(
                  utils.nonNillableInputType(
                    new utils.ObjectInputType({
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
                  ),
                ),
                nullable: false,
                // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                public: reverseEdge.head
                  .getUpdateWithoutEdgeInputType(reverseEdge.originalEdge)
                  .isPublic(),
              }),
            );

            if (
              reverseEdge.head.isPartiallyIdentifiableByEdge(
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
                    reverseEdge.head
                      .getUniqueFilterWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      )
                      .isPublic() &&
                    reverseEdge.head
                      .getUpdateWithoutEdgeInputType(reverseEdge.originalEdge)
                      .isPublic(),
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
                    reverseEdge.head
                      .getUniqueFilterWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      )
                      .isPublic() &&
                    reverseEdge.head
                      .getUpdateWithoutEdgeInputType(reverseEdge.originalEdge)
                      .isPublic(),
                }),
              );
            }
          }

          if (
            reverseEdge.head.isPartiallyIdentifiableByEdge(
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
                  reverseEdge.head
                    .getUniqueFilterWithoutEdgeInputType(
                      reverseEdge.originalEdge,
                    )
                    .isPublic() &&
                  reverseEdge.head
                    .getCreationWithoutEdgeInputType(reverseEdge.originalEdge)
                    .isPublic() &&
                  reverseEdge.head
                    .getUpdateWithoutEdgeInputType(reverseEdge.originalEdge)
                    .isPublic(),
              }),
            );
          }

          return fields;
        },
      }),
    });
  }

  public override hasActions(
    inputValue: Readonly<NonNullable<MultipleReverseEdgeUpdateInputValue>>,
  ): boolean {
    return multipleReverseEdgeUpdateInputActions.some((action) => {
      if (inputValue[action] != null) {
        switch (action) {
          case MultipleReverseEdgeUpdateInputAction.UPDATE_ALL:
          case MultipleReverseEdgeUpdateInputAction.DELETE_ALL:
          case MultipleReverseEdgeUpdateInputAction.DELETE_MANY:
            return true;

          case MultipleReverseEdgeUpdateInputAction.CREATE_SOME:
          case MultipleReverseEdgeUpdateInputAction.CREATE_SOME_IF_NOT_EXISTS:
          case MultipleReverseEdgeUpdateInputAction.UPDATE_MANY:
          case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME:
          case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS:
          case MultipleReverseEdgeUpdateInputAction.UPSERT_SOME:
          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME:
          case MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS:
            return inputValue[action].length > 0;

          default:
            throw new utils.UnreachableValueError(action);
        }
      }

      return false;
    });
  }

  public override async applyActions(
    nodeValues: ReadonlyArray<NodeValue>,
    inputValue: Readonly<NonNullable<MultipleReverseEdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void> {
    const headAPI = this.reverseEdge.head.createContextBoundAPI(context);

    const selection = this.reverseEdge.head.mainIdentifier.selection;
    const originalEdge = this.reverseEdge.originalEdge;
    const originalEdgeName = originalEdge.name;
    const originalEdgeValues = nodeValues.map((nodeValue) =>
      originalEdge.referencedUniqueConstraint.parseValue(nodeValue),
    );

    // Apply destructive actions first, if any
    for (const actionName of R.filter(
      R.keys(inputValue),
      isDestructiveActionName,
    )) {
      const actionPath = utils.addPath(path, actionName);

      switch (actionName) {
        case MultipleReverseEdgeUpdateInputAction.DELETE_ALL: {
          const actionData = inputValue[actionName]!;

          if (actionData === true) {
            await headAPI.deleteMany(
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

          await headAPI.deleteMany(
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

          await headAPI.deleteSomeInOrder(
            {
              where: originalEdgeValues.flatMap((originalEdgeValue) =>
                actionData.map((where) => ({
                  ...where,
                  [originalEdgeName]: originalEdgeValue,
                })),
              ),
              selection,
            },
            actionPath,
          );
          break;
        }

        case MultipleReverseEdgeUpdateInputAction.DELETE_SOME_IF_EXISTS: {
          const actionData = inputValue[actionName]!;

          await headAPI.deleteSomeInOrderIfExists(
            {
              where: originalEdgeValues.flatMap((originalEdgeValue) =>
                actionData.map((where) => ({
                  ...where,
                  [originalEdgeName]: originalEdgeValue,
                })),
              ),
              selection,
            },
            actionPath,
          );
          break;
        }

        default:
          throw new utils.UnreachableValueError(actionName, { path });
      }
    }

    // Then the non-destructive ones, if any
    for (const actionName of R.filter(
      R.keys(inputValue),
      isNonDestructiveActionName,
    )) {
      const actionPath = utils.addPath(path, actionName);

      switch (actionName) {
        case MultipleReverseEdgeUpdateInputAction.CREATE_SOME: {
          const actionData = inputValue[actionName]!;

          await headAPI.createSome(
            {
              data: originalEdgeValues.flatMap((originalEdgeValue) =>
                actionData.map((data) => ({
                  ...data,
                  [originalEdgeName]: {
                    [EdgeUpdateInputAction.REFERENCE]: originalEdgeValue,
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

          for (const originalEdgeValue of originalEdgeValues) {
            for (const [index, { where, data }] of actionData.entries()) {
              await headAPI.createOneIfNotExists(
                {
                  where: {
                    ...where,
                    [originalEdgeName]: originalEdgeValue,
                  },
                  data: {
                    ...data,
                    [originalEdgeName]: {
                      [EdgeUpdateInputAction.REFERENCE]: originalEdgeValue,
                    },
                  },
                  selection,
                },
                utils.addPath(actionPath, index),
              );
            }
          }
          break;
        }

        case MultipleReverseEdgeUpdateInputAction.UPDATE_ALL: {
          const data = inputValue[actionName]!;

          await headAPI.updateMany(
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
          for (const [index, { where, data }] of inputValue[
            actionName
          ]!.entries()) {
            await headAPI.updateMany(
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
              utils.addPath(actionPath, index),
            );
          }
          break;
        }

        case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME: {
          const actionData = inputValue[actionName]!;

          for (const [index, { data, where }] of actionData.entries()) {
            await headAPI.updateSomeInOrder(
              {
                data,
                where: originalEdgeValues.map((originalEdgeValue) => ({
                  ...where,
                  [originalEdgeName]: originalEdgeValue,
                })),
                selection,
              },
              utils.addPath(actionPath, index),
            );
          }
          break;
        }

        case MultipleReverseEdgeUpdateInputAction.UPDATE_SOME_IF_EXISTS: {
          const actionData = inputValue[actionName]!;

          for (const [index, { data, where }] of actionData.entries()) {
            await headAPI.updateSomeInOrderIfExists(
              {
                data,
                where: originalEdgeValues.map((originalEdgeValue) => ({
                  ...where,
                  [originalEdgeName]: originalEdgeValue,
                })),
                selection,
              },
              utils.addPath(actionPath, index),
            );
          }
          break;
        }

        case MultipleReverseEdgeUpdateInputAction.UPSERT_SOME: {
          const actionData = inputValue[actionName]!;

          for (const originalEdgeValue of originalEdgeValues) {
            for (const [
              index,
              { where, create, update },
            ] of actionData.entries()) {
              await headAPI.upsert(
                {
                  where: {
                    ...where,
                    [originalEdgeName]: originalEdgeValue,
                  },
                  create: {
                    ...create,
                    [originalEdgeName]: {
                      [EdgeUpdateInputAction.REFERENCE]: originalEdgeValue,
                    },
                  },
                  update,
                  selection,
                },
                utils.addPath(actionPath, index),
              );
            }
          }
          break;
        }

        default:
          throw new utils.UnreachableValueError(actionName, { path });
      }
    }
  }
}
