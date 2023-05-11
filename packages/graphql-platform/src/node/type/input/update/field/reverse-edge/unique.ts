import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { IterableElement } from 'type-fest';
import type {
  NodeUpdateInputValue,
  NodeValue,
} from '../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import { AbstractReverseEdgeUpdateInput } from '../abstract-reverse-edge.js';
import { EdgeUpdateInputAction } from '../component/edge.js';

export enum UniqueReverseEdgeUpdateInputAction {
  // Destructive actions
  DELETE = 'delete',
  DELETE_IF_EXISTS = 'deleteIfExists',

  // Non-destructive actions
  CREATE = 'create',
  CREATE_IF_NOT_EXISTS = 'createIfNotExists',
  UPDATE = 'update',
  UPDATE_IF_EXISTS = 'updateIfExists',
  UPSERT = 'upsert',
}

export type UniqueReverseEdgeUpdateInputValue = utils.Optional<
  Partial<{
    // Destructive actions
    [UniqueReverseEdgeUpdateInputAction.DELETE]: boolean;
    [UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS]: boolean;

    // Non-destructive actions
    [UniqueReverseEdgeUpdateInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
    [UniqueReverseEdgeUpdateInputAction.CREATE_IF_NOT_EXISTS]: NonNullable<NodeCreationInputValue>;
    [UniqueReverseEdgeUpdateInputAction.UPDATE]: NonNullable<NodeUpdateInputValue>;
    [UniqueReverseEdgeUpdateInputAction.UPDATE_IF_EXISTS]: NonNullable<NodeUpdateInputValue>;
    [UniqueReverseEdgeUpdateInputAction.UPSERT]: NonNullable<{
      create: NonNullable<NodeCreationInputValue>;
      update?: NodeUpdateInputValue;
    }>;
  }>
>;

const destructiveActionNames = [
  UniqueReverseEdgeUpdateInputAction.DELETE,
  UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS,
] satisfies UniqueReverseEdgeUpdateInputAction[];

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  UniqueReverseEdgeUpdateInputAction,
  DestructiveActionName
>;

const nonDestructiveActionNames = [
  UniqueReverseEdgeUpdateInputAction.CREATE,
  UniqueReverseEdgeUpdateInputAction.CREATE_IF_NOT_EXISTS,
  UniqueReverseEdgeUpdateInputAction.UPDATE,
  UniqueReverseEdgeUpdateInputAction.UPDATE_IF_EXISTS,
  UniqueReverseEdgeUpdateInputAction.UPSERT,
] satisfies NonDestructiveActionName[];

export class UniqueReverseEdgeUpdateInput extends AbstractReverseEdgeUpdateInput<UniqueReverseEdgeUpdateInputValue> {
  public static supports(reverseEdge: UniqueReverseEdge): boolean {
    return (
      reverseEdge.head.isDeletable() ||
      reverseEdge.head.isCreatable() ||
      reverseEdge.head.isUpdatable(reverseEdge.originalEdge)
    );
  }

  public constructor(public override readonly reverseEdge: UniqueReverseEdge) {
    assert(
      UniqueReverseEdgeUpdateInput.supports(reverseEdge),
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
                name: UniqueReverseEdgeUpdateInputAction.DELETE,
                type: scalars.typesByName.Boolean,
                nullable: false,
                public: reverseEdge.head.isPubliclyDeletable(),
              }),
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS,
                type: scalars.typesByName.Boolean,
                nullable: false,
                public: reverseEdge.head.isPubliclyDeletable(),
              }),
            );
          }

          if (reverseEdge.head.isCreatable()) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.CREATE,
                type: reverseEdge.head.getCreationWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
              }),
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.CREATE_IF_NOT_EXISTS,
                type: reverseEdge.head.getCreationWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
              }),
            );
          }

          if (reverseEdge.head.isUpdatable(reverseEdge.originalEdge)) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.UPDATE,
                type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
              }),
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.UPDATE_IF_EXISTS,
                type: reverseEdge.head.getUpdateWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
              }),
            );
          }

          if (
            reverseEdge.head.isCreatable() &&
            reverseEdge.head.isUpdatable(reverseEdge.originalEdge)
          ) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeUpdateInputAction.UPSERT,
                type: new utils.ObjectInputType({
                  name: [
                    reverseEdge.tail.name,
                    inflection.camelize(utils.MutationType.UPDATE),
                    reverseEdge.pascalCasedName,
                    inflection.camelize(
                      UniqueReverseEdgeUpdateInputAction.UPSERT,
                    ),
                    'Input',
                  ].join(''),
                  fields: () => [
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
                nullable: false,
                // We explicitly define the visibility as we don't want to expose this operation if the head it not publicly updatable, and it would as "update" is not required
                public:
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
    nodeValues: ReadonlyArray<NodeValue>,
    inputValue: Readonly<NonNullable<UniqueReverseEdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void> {
    const selection = this.reverseEdge.head.identifier.selection;
    const originalEdge = this.reverseEdge.originalEdge;
    const originalEdgeName = originalEdge.name;
    const originalEdgeValues = nodeValues.map((nodeValue) =>
      originalEdge.referencedUniqueConstraint.parseValue(nodeValue),
    );

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
              await Promise.all(
                originalEdgeValues.map((originalEdgeValue) =>
                  this.reverseEdge.head.getMutationByKey('delete-one').execute(
                    {
                      where: { [originalEdgeName]: originalEdgeValue },
                      selection,
                    },
                    context,
                    actionPath,
                  ),
                ),
              );
            }
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-many')
                .execute(
                  {
                    where: { [originalEdgeName]: { OR: originalEdgeValues } },
                    first: originalEdgeValues.length,
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

    // Then the others
    {
      const maybeActionName = inputActionNames.find(
        (actionName): actionName is NonDestructiveActionName =>
          nonDestructiveActionNames.includes(actionName as any),
      );

      if (maybeActionName) {
        const actionPath = utils.addPath(path, maybeActionName);

        switch (maybeActionName) {
          case UniqueReverseEdgeUpdateInputAction.CREATE: {
            const data = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutationByKey('create-some').execute(
              {
                data: originalEdgeValues.map((originalEdgeValue) => ({
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

          case UniqueReverseEdgeUpdateInputAction.CREATE_IF_NOT_EXISTS: {
            const data = inputValue[maybeActionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                this.reverseEdge.head
                  .getMutationByKey('create-one-if-not-exists')
                  .execute(
                    {
                      where: { [originalEdgeName]: originalEdgeValue },
                      data: {
                        ...data,
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

          case UniqueReverseEdgeUpdateInputAction.UPDATE: {
            const data = inputValue[maybeActionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                this.reverseEdge.head.getMutationByKey('update-one').execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    data,
                    selection,
                  },
                  context,
                  actionPath,
                ),
              ),
            );
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.UPDATE_IF_EXISTS: {
            const data = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: { [originalEdgeName]: { OR: originalEdgeValues } },
                first: originalEdgeValues.length,
                data,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case UniqueReverseEdgeUpdateInputAction.UPSERT: {
            const { create, update } = inputValue[maybeActionName]!;

            await Promise.all(
              originalEdgeValues.map((originalEdgeValue) =>
                this.reverseEdge.head.getMutationByKey('upsert').execute(
                  {
                    where: { [originalEdgeName]: originalEdgeValue },
                    create: {
                      ...create,
                      [originalEdgeName]: {
                        [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                      },
                    },
                    update,
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
            throw new utils.UnreachableValueError(maybeActionName, { path });
        }
      }
    }
  }
}
