import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  MutationType,
  nonNillableInputType,
  NonNullableInputType,
  ObjectInputType,
  UnexpectedValueError,
  UnreachableValueError,
  type NonNillable,
  type Optional,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import _ from 'lodash';
import type { IterableElement } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractReverseEdgeUpdateInput } from '../abstract-reverse-edge.js';

export enum ReverseEdgeUniqueUpdateInputAction {
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

export type ReverseEdgeUniqueUpdateInputValue = Optional<
  Partial<{
    // Destructive actions
    [ReverseEdgeUniqueUpdateInputAction.DELETE]: boolean;
    [ReverseEdgeUniqueUpdateInputAction.DELETE_IF_EXISTS]: boolean;
    [ReverseEdgeUniqueUpdateInputAction.DISCONNECT]: boolean;
    [ReverseEdgeUniqueUpdateInputAction.DISCONNECT_IF_EXISTS]: boolean;

    // Non-destructive actions
    [ReverseEdgeUniqueUpdateInputAction.CONNECT]: NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueUpdateInputAction.CONNECT_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueUpdateInputAction.CONNECT_OR_CREATE]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>;
    [ReverseEdgeUniqueUpdateInputAction.CREATE]: NonNillable<NodeCreationInputValue>;
  }>
>;

const destructiveActionNames = [
  ReverseEdgeUniqueUpdateInputAction.DELETE,
  ReverseEdgeUniqueUpdateInputAction.DELETE_IF_EXISTS,
  ReverseEdgeUniqueUpdateInputAction.DISCONNECT,
  ReverseEdgeUniqueUpdateInputAction.DISCONNECT_IF_EXISTS,
] as const;

type DestructiveActionName = IterableElement<typeof destructiveActionNames>;

type NonDestructiveActionName = Exclude<
  ReverseEdgeUniqueUpdateInputAction,
  DestructiveActionName
>;

const nonDestructiveActionNames = [
  ReverseEdgeUniqueUpdateInputAction.CONNECT,
  ReverseEdgeUniqueUpdateInputAction.CONNECT_IF_EXISTS,
  ReverseEdgeUniqueUpdateInputAction.CONNECT_OR_CREATE,
  ReverseEdgeUniqueUpdateInputAction.CREATE,
] as const;

export class ReverseEdgeUniqueUpdateInput extends AbstractReverseEdgeUpdateInput<ReverseEdgeUniqueUpdateInputValue> {
  public constructor(public override readonly reverseEdge: ReverseEdgeUnique) {
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
                name: ReverseEdgeUniqueUpdateInputAction.DELETE,
                type: new NonNullableInputType(Scalars.Boolean),
                public: reverseEdge.head.isMutationPublic(
                  MutationType.DELETION,
                ),
              }),
              new Input({
                name: ReverseEdgeUniqueUpdateInputAction.DELETE_IF_EXISTS,
                type: new NonNullableInputType(Scalars.Boolean),
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
                  name: ReverseEdgeUniqueUpdateInputAction.DISCONNECT,
                  type: new NonNullableInputType(Scalars.Boolean),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
                new Input({
                  name: ReverseEdgeUniqueUpdateInputAction.DISCONNECT_IF_EXISTS,
                  type: new NonNullableInputType(Scalars.Boolean),
                  public: reverseEdge.head.isMutationPublic(
                    MutationType.UPDATE,
                  ),
                }),
              );
            }

            fields.push(
              new Input({
                name: ReverseEdgeUniqueUpdateInputAction.CONNECT,
                type: new NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
              new Input({
                name: ReverseEdgeUniqueUpdateInputAction.CONNECT_IF_EXISTS,
                type: new NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
            );

            if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
              fields.push(
                new Input({
                  name: ReverseEdgeUniqueUpdateInputAction.CONNECT_OR_CREATE,
                  type: new NonNullableInputType(
                    new ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        'Nested',
                        inflection.camelize(
                          ReverseEdgeUniqueUpdateInputAction.CONNECT_OR_CREATE,
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
                  public:
                    reverseEdge.head.isMutationPublic(MutationType.UPDATE) &&
                    reverseEdge.head.isMutationPublic(MutationType.CREATION),
                }),
              );
            }
          }

          if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
            fields.push(
              new Input({
                name: ReverseEdgeUniqueUpdateInputAction.CREATE,
                type: new NonNullableInputType(
                  reverseEdge.head.getCreationWithoutEdgeInputType(
                    reverseEdge.originalEdge,
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
      validateValue(inputValue, path) {
        if (inputValue) {
          const inputActionNames = Object.keys(
            inputValue,
          ) as ReverseEdgeUniqueUpdateInputAction[];

          if (
            _.intersection(inputActionNames, destructiveActionNames).length > 1
          ) {
            throw new UnexpectedValueError(
              `no more than one destructive action among ${destructiveActionNames.join(
                ', ',
              )}`,
              inputValue,
              { path },
            );
          }

          if (
            _.intersection(inputActionNames, nonDestructiveActionNames).length >
            1
          ) {
            throw new UnexpectedValueError(
              `no more than one action among ${nonDestructiveActionNames.join(
                ', ',
              )}`,
              inputValue,
              { path },
            );
          }
        }
      },
    });
  }

  public override async applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNillable<ReverseEdgeUniqueUpdateInputValue>>,
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

    const inputActionNames = Object.keys(
      inputValue,
    ) as ReverseEdgeUniqueUpdateInputAction[];

    // Apply destructive action first
    {
      const maybeActionName = inputActionNames.find(
        (actionName): actionName is DestructiveActionName =>
          destructiveActionNames.includes(actionName as any),
      );

      if (maybeActionName) {
        const actionPath = addPath(path, maybeActionName);

        switch (maybeActionName) {
          case ReverseEdgeUniqueUpdateInputAction.DELETE: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head.getMutation('delete-one').execute(
                {
                  where: originalEdgeValue,
                  selection,
                },
                context,
                actionPath,
              );
            }
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.DELETE_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutation('delete-one-if-exists')
                .execute(
                  {
                    where: originalEdgeValue,
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.DISCONNECT: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head.getMutation('update-one').execute(
                {
                  where: originalEdgeValue,
                  data: { [this.reverseEdge.originalEdge.name]: null },
                  selection,
                },
                context,
                actionPath,
              );
            }
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.DISCONNECT_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            if (actionData === true) {
              await this.reverseEdge.head
                .getMutation('update-one-if-exists')
                .execute(
                  {
                    where: originalEdgeValue,
                    data: { [this.reverseEdge.originalEdge.name]: null },
                    selection,
                  },
                  context,
                  actionPath,
                );
            }
            break;
          }

          default:
            throw new UnreachableValueError(maybeActionName, { path });
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
        const actionPath = addPath(path, maybeActionName);

        switch (maybeActionName) {
          case ReverseEdgeUniqueUpdateInputAction.CONNECT: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutation('update-one').execute(
              {
                where: actionData,
                data: originalEdgeValue,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.CONNECT_IF_EXISTS: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head
              .getMutation('update-one-if-exists')
              .execute(
                {
                  where: actionData,
                  data: originalEdgeValue,
                  selection,
                },
                context,
                actionPath,
              );
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.CONNECT_OR_CREATE: {
            const { where, create } = inputValue[maybeActionName]!;

            await this.reverseEdge.head.getMutation('upsert').execute(
              {
                where,
                create: { ...create, ...originalEdgeValue },
                update: originalEdgeValue,
                selection,
              },
              context,
              actionPath,
            );
            break;
          }

          case ReverseEdgeUniqueUpdateInputAction.CREATE: {
            const actionData = inputValue[maybeActionName]!;

            await this.reverseEdge.head
              .getMutation('create-one')
              .execute(
                { data: { ...actionData, ...originalEdgeValue }, selection },
                context,
                actionPath,
              );
            break;
          }

          default:
            throw new UnreachableValueError(maybeActionName, { path });
        }
      }
    }
  }
}
