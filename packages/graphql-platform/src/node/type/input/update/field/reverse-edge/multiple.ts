import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  aggregateConcurrentError,
  Input,
  ListableInputType,
  MutationType,
  nonNillableInputType,
  NonNullableInputType,
  ObjectInputType,
  UnreachableValueError,
  type NonNillable,
  type Optional,
  type Path,
} from '@prismamedia/graphql-platform-utils';
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

export enum ReverseEdgeMultipleUpdateInputAction {
  // Destructive actions
  DELETE_ALL = 'deleteAll',
  DELETE_MANY = 'deleteMany',
  DELETE_SOME = 'deleteSome',
  DELETE_SOME_IF_EXISTS = 'deleteSomeIfExists',
  DISCONNECT_ALL = 'disconnectAll',
  DISCONNECT_MANY = 'disconnectMany',
  DISCONNECT_SOME = 'disconnectSome',
  DISCONNECT_SOME_IF_EXISTS = 'disconnectSomeIfExists',

  // Non-destructive actions
  CONNECT_MANY = 'connectMany',
  CONNECT_OR_CREATE_SOME = 'connectOrCreateSome',
  CONNECT_SOME = 'connectSome',
  CONNECT_SOME_IF_EXISTS = 'connectSomeIfExists',
  CREATE_SOME = 'createSome',
}

export type ReverseEdgeMultipleUpdateInputValue = Optional<
  Partial<{
    // Destructive actions
    [ReverseEdgeMultipleUpdateInputAction.DELETE_ALL]: boolean;
    [ReverseEdgeMultipleUpdateInputAction.DELETE_MANY]: NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.DELETE_SOME]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL]: boolean;
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY]: NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>[];

    // Non-destructive actions
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY]: NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>[];
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleUpdateInputAction.CREATE_SOME]: NonNillable<NodeCreationInputValue>[];
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
      type: new ObjectInputType({
        name: [
          reverseEdge.tail.name,
          'Nested',
          reverseEdge.pascalCasedName,
          'ReverseEdge',
          inflection.camelize(MutationType.UPDATE),
          'Input',
        ].join(''),
        fields: () => {
          const fields: Input[] = [];

          if (reverseEdge.head.isMutationEnabled(MutationType.DELETION)) {
            fields.push(
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_ALL,
                type: new NonNullableInputType(Scalars.Boolean),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.DELETION,
                ),
              }),
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_MANY,
                type: new NonNullableInputType(
                  reverseEdge.head.filterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.DELETION,
                ),
              }),
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_SOME,
                type: new NonNullableInputType(
                  new ListableInputType(
                    nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.DELETION,
                ),
              }),
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS,
                type: new NonNullableInputType(
                  new ListableInputType(
                    nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.DELETION,
                ),
              }),
            );
          }

          if (
            reverseEdge.head.isMutationEnabled(MutationType.UPDATE) &&
            reverseEdge.originalEdge.isMutable()
          ) {
            if (reverseEdge.originalEdge.isNullable()) {
              fields.push(
                new Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_ALL,
                  type: new NonNullableInputType(Scalars.Boolean),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
                new Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_MANY,
                  type: new NonNullableInputType(
                    reverseEdge.head.filterInputType,
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
                new Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME,
                  type: new NonNullableInputType(
                    new ListableInputType(
                      nonNillableInputType(
                        reverseEdge.head.uniqueFilterInputType,
                      ),
                    ),
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
                new Input({
                  name: ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS,
                  type: new NonNullableInputType(
                    new ListableInputType(
                      nonNillableInputType(
                        reverseEdge.head.uniqueFilterInputType,
                      ),
                    ),
                  ),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
              );
            }

            fields.push(
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY,
                type: new NonNullableInputType(
                  reverseEdge.head.filterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
            );

            if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
              fields.push(
                new Input({
                  name: ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME,
                  type: new NonNullableInputType(
                    new ListableInputType(
                      nonNillableInputType(
                        new ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME,
                            ),
                            reverseEdge.pascalCasedName,
                            'ReverseEdge',
                            inflection.camelize(MutationType.UPDATE),
                            'Input',
                          ].join(''),
                          fields: () => [
                            new Input({
                              name: 'where',
                              type: nonNillableInputType(
                                reverseEdge.head.uniqueFilterInputType,
                              ),
                            }),
                            new Input({
                              name: 'create',
                              type: nonNillableInputType(
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
                    reverseEdge.head.isMutationPublic(MutationType.UPDATE) &&
                    reverseEdge.head.isMutationPublic(MutationType.CREATION),
                }),
              );
            }

            fields.push(
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME,
                type: new NonNullableInputType(
                  new ListableInputType(
                    nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS,
                type: new NonNullableInputType(
                  new ListableInputType(
                    nonNillableInputType(
                      reverseEdge.head.uniqueFilterInputType,
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
            );
          }

          if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
            fields.push(
              new Input({
                name: ReverseEdgeMultipleUpdateInputAction.CREATE_SOME,
                type: new NonNullableInputType(
                  new ListableInputType(
                    nonNillableInputType(
                      reverseEdge.head.getCreationWithoutEdgeInputType(
                        reverseEdge.originalEdge,
                      ),
                    ),
                  ),
                ),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.CREATION,
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
    inputValue: Readonly<NonNillable<ReverseEdgeMultipleUpdateInputValue>>,
    context: MutationContext,
    path: Path,
  ): Promise<void> {
    const originalEdgeValue = {
      [this.reverseEdge.originalEdge.name]:
        this.reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
          nodeValue,
          path,
        ),
    };
    const selection = this.reverseEdge.head.identifier.selection;

    // Apply destructive actions first
    await Promise.all(
      _.intersection<DestructiveActionName>(
        Object.keys(inputValue) as any,
        destructiveActionNames,
      ).map(async (actionName) => {
        const actionPath = addPath(path, actionName);

        switch (actionName) {
          case ReverseEdgeMultipleUpdateInputAction.DELETE_ALL: {
            const actionData = inputValue[actionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutationByKey('delete-many')
                .execute(
                  {
                    where: originalEdgeValue,
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
                where: { AND: [originalEdgeValue, actionData] },
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

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head.getMutationByKey('delete-one').execute(
                  {
                    where: { ...where, ...originalEdgeValue },
                    selection,
                  },
                  context,
                  addPath(actionPath, index),
                ),
              { path: actionPath },
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DELETE_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('delete-one-if-exists')
                  .execute(
                    {
                      where: { ...where, ...originalEdgeValue },
                      selection,
                    },
                    context,
                    addPath(actionPath, index),
                  ),
              { path: actionPath },
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
                    where: originalEdgeValue,
                    data: { [this.reverseEdge.originalEdge.name]: null },
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
                where: { AND: [originalEdgeValue, actionData] },
                data: { [this.reverseEdge.originalEdge.name]: null },
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

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head.getMutationByKey('update-one').execute(
                  {
                    where: { ...where, ...originalEdgeValue },
                    data: { [this.reverseEdge.originalEdge.name]: null },
                    selection,
                  },
                  context,
                  addPath(actionPath, index),
                ),
              { path: actionPath },
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.DISCONNECT_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('update-one-if-exists')
                  .execute(
                    {
                      where: { ...where, ...originalEdgeValue },
                      data: { [this.reverseEdge.originalEdge.name]: null },
                      selection,
                    },
                    context,
                    addPath(actionPath, index),
                  ),
              { path: actionPath },
            );
            break;
          }

          default:
            throw new UnreachableValueError(actionName, { path });
        }
      }),
    );

    // Then the others
    await Promise.all(
      _.difference<NonDestructiveActionName>(
        Object.keys(inputValue) as any,
        destructiveActionNames as any,
      ).map(async (actionName) => {
        const actionPath = addPath(path, actionName);

        switch (actionName) {
          case ReverseEdgeMultipleUpdateInputAction.CONNECT_MANY: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('update-many').execute(
              {
                where: actionData,
                first: 1_000_000,
                data: originalEdgeValue,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_OR_CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await aggregateConcurrentError(
              actionData,
              ({ where, create }, index) =>
                this.reverseEdge.head.getMutationByKey('upsert').execute(
                  {
                    where,
                    create: {
                      ...create,
                      ...originalEdgeValue,
                    },
                    update: originalEdgeValue,
                    selection,
                  },
                  context,
                  addPath(actionPath, index),
                ),
              { path: actionPath },
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME: {
            const actionData = inputValue[actionName]!;

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head.getMutationByKey('update-one').execute(
                  {
                    where,
                    data: originalEdgeValue,
                    selection,
                  },
                  context,
                  addPath(actionPath, index),
                ),
              { path: actionPath },
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.CONNECT_SOME_IF_EXISTS: {
            const actionData = inputValue[actionName]!;

            await aggregateConcurrentError(
              actionData,
              (where, index) =>
                this.reverseEdge.head
                  .getMutationByKey('update-one-if-exists')
                  .execute(
                    {
                      where,
                      data: originalEdgeValue,
                      selection,
                    },
                    context,
                    addPath(actionPath, index),
                  ),
              { path: actionPath },
            );
            break;
          }

          case ReverseEdgeMultipleUpdateInputAction.CREATE_SOME: {
            const actionData = inputValue[actionName]!;

            await this.reverseEdge.head.getMutationByKey('create-some').execute(
              {
                data: actionData.map((data) => ({
                  ...data,
                  ...originalEdgeValue,
                })),
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          default:
            throw new UnreachableValueError(actionName, { path });
        }
      }),
    );
  }
}
