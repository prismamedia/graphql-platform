import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { NodeValue } from '../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeFilterInputValue } from '../../../filter.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum MultipleReverseEdgeCreationInputAction {
  CONNECT_MANY = 'connectMany',
  CONNECT_OR_CREATE_SOME = 'connectOrCreate',
  CONNECT_SOME = 'connect',
  CONNECT_SOME_IF_EXISTS = 'connectIfExists',
  CREATE_SOME = 'create',
}

export type MultipleReverseEdgeCreationInputValue = utils.Optional<
  Partial<{
    [MultipleReverseEdgeCreationInputAction.CONNECT_MANY]: NonNullable<NodeFilterInputValue>;
    [MultipleReverseEdgeCreationInputAction.CONNECT_OR_CREATE_SOME]: NonNullable<{
      connect: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
    }>[];
    [MultipleReverseEdgeCreationInputAction.CONNECT_SOME]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeCreationInputAction.CONNECT_SOME_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>[];
    [MultipleReverseEdgeCreationInputAction.CREATE_SOME]: NonNullable<NodeCreationInputValue>[];
  }>
>;

export class MultipleReverseEdgeCreationInput extends AbstractReverseEdgeCreationInput<MultipleReverseEdgeCreationInputValue> {
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
                name: MultipleReverseEdgeCreationInputAction.CONNECT_MANY,
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
                  name: MultipleReverseEdgeCreationInputAction.CONNECT_OR_CREATE_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        new utils.ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              MultipleReverseEdgeCreationInputAction.CONNECT_OR_CREATE_SOME,
                            ),
                            reverseEdge.pascalCasedName,
                            'ReverseEdge',
                            inflection.camelize(utils.MutationType.CREATION),
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
              );
            }

            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeCreationInputAction.CONNECT_SOME,
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
                name: MultipleReverseEdgeCreationInputAction.CONNECT_SOME_IF_EXISTS,
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
                name: MultipleReverseEdgeCreationInputAction.CREATE_SOME,
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
    inputValue: Readonly<NonNullable<MultipleReverseEdgeCreationInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<void> {
    const originalEdge = this.reverseEdge.originalEdge;
    const originalEdgeName = originalEdge.name;
    const originalEdgeValue =
      originalEdge.referencedUniqueConstraint.parseValue(nodeValue, path);
    const selection = this.reverseEdge.head.identifier.selection;

    await Promise.all(
      (Object.keys(inputValue) as MultipleReverseEdgeCreationInputAction[]).map(
        async (actionName) => {
          const actionPath = utils.addPath(path, actionName);

          switch (actionName) {
            case MultipleReverseEdgeCreationInputAction.CONNECT_MANY: {
              const actionData = inputValue[actionName]!;

              await this.reverseEdge.head
                .getMutationByKey('update-many')
                .execute(
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

            case MultipleReverseEdgeCreationInputAction.CONNECT_OR_CREATE_SOME: {
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

            case MultipleReverseEdgeCreationInputAction.CONNECT_SOME: {
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

            case MultipleReverseEdgeCreationInputAction.CONNECT_SOME_IF_EXISTS: {
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

            case MultipleReverseEdgeCreationInputAction.CREATE_SOME: {
              const actionData = inputValue[actionName]!;

              await this.reverseEdge.head
                .getMutationByKey('create-some')
                .execute(
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
              throw new utils.UnreachableValueError(actionName, {
                path,
              });
          }
        },
      ),
    );
  }
}
