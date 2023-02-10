import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { RequireExactlyOne } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum UniqueReverseEdgeCreationInputAction {
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
}

export type UniqueReverseEdgeCreationInputValue = utils.Optional<
  RequireExactlyOne<{
    [UniqueReverseEdgeCreationInputAction.CONNECT]: NonNullable<NodeUniqueFilterInputValue>;
    [UniqueReverseEdgeCreationInputAction.CONNECT_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>;
    [UniqueReverseEdgeCreationInputAction.CONNECT_OR_CREATE]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
    }>;
    [UniqueReverseEdgeCreationInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
  }>
>;

export class UniqueReverseEdgeCreationInput extends AbstractReverseEdgeCreationInput<UniqueReverseEdgeCreationInputValue> {
  public constructor(public override readonly reverseEdge: UniqueReverseEdge) {
    super(reverseEdge, {
      type: new utils.ObjectInputType({
        name: [
          reverseEdge.tail.name,
          'Nested',
          reverseEdge.pascalCasedName,
          'ReverseEdge',
          inflection.camelize(utils.MutationType.CREATION),
          'Input',
        ].join(''),
        fields: () => {
          const fields: utils.Input[] = [];

          if (
            reverseEdge.head.isMutationEnabled(utils.MutationType.UPDATE) &&
            reverseEdge.originalEdge.isMutable()
          ) {
            fields.push(
              new utils.Input({
                name: UniqueReverseEdgeCreationInputAction.CONNECT,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
              new utils.Input({
                name: UniqueReverseEdgeCreationInputAction.CONNECT_IF_EXISTS,
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
                  name: UniqueReverseEdgeCreationInputAction.CONNECT_OR_CREATE,
                  type: new utils.NonNullableInputType(
                    new utils.ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        'Nested',
                        inflection.camelize(
                          UniqueReverseEdgeCreationInputAction.CONNECT_OR_CREATE,
                        ),
                        reverseEdge.pascalCasedName,
                        'ReverseEdge',
                        inflection.camelize(utils.MutationType.CREATION),
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
                name: UniqueReverseEdgeCreationInputAction.CREATE,
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
        if (Object.keys(inputValue).length > 1) {
          throw new utils.UnexpectedValueError(
            `at most one action`,
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
    inputValue: Readonly<NonNullable<UniqueReverseEdgeCreationInputValue>>,
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

    const maybeActionName = Object.keys(
      inputValue,
    )[0] as UniqueReverseEdgeCreationInputAction;
    const actionPath = utils.addPath(path, maybeActionName);

    switch (maybeActionName) {
      case UniqueReverseEdgeCreationInputAction.CONNECT: {
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

      case UniqueReverseEdgeCreationInputAction.CONNECT_IF_EXISTS: {
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

      case UniqueReverseEdgeCreationInputAction.CONNECT_OR_CREATE: {
        const { where, create } = inputValue[maybeActionName]!;

        await this.reverseEdge.head.getMutationByKey('upsert').execute(
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
          actionPath,
        );
        break;
      }

      case UniqueReverseEdgeCreationInputAction.CREATE: {
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
        throw new utils.UnreachableValueError(maybeActionName, {
          path,
        });
    }
  }
}
