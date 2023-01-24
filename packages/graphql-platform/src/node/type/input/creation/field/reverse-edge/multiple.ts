import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeFilterInputValue } from '../../../filter.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum ReverseEdgeMultipleCreationInputAction {
  CONNECT_MANY = 'connectMany',
  CONNECT_OR_CREATE_SOME = 'connectOrCreate',
  CONNECT_SOME = 'connect',
  CONNECT_SOME_IF_EXISTS = 'connectIfExists',
  CREATE_SOME = 'create',
}

export type ReverseEdgeMultipleCreationInputValue = utils.Optional<
  Partial<{
    [ReverseEdgeMultipleCreationInputAction.CONNECT_MANY]: NonNullable<NodeFilterInputValue>;
    [ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      create: NonNullable<NodeCreationInputValue>;
    }>[];
    [ReverseEdgeMultipleCreationInputAction.CONNECT_SOME]: NonNullable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleCreationInputAction.CREATE_SOME]: NonNullable<NodeCreationInputValue>[];
  }>
>;

export class ReverseEdgeMultipleCreationInput extends AbstractReverseEdgeCreationInput<ReverseEdgeMultipleCreationInputValue> {
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
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_MANY,
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
                  name: ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME,
                  type: new utils.NonNullableInputType(
                    new utils.ListableInputType(
                      utils.nonNillableInputType(
                        new utils.ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME,
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
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_SOME,
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
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS,
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
                name: ReverseEdgeMultipleCreationInputAction.CREATE_SOME,
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
    inputValue: Readonly<NonNullable<ReverseEdgeMultipleCreationInputValue>>,
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

    await Promise.all(
      (Object.keys(inputValue) as ReverseEdgeMultipleCreationInputAction[]).map(
        async (actionName) => {
          const actionPath = utils.addPath(path, actionName);

          switch (actionName) {
            case ReverseEdgeMultipleCreationInputAction.CONNECT_MANY: {
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME: {
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_SOME: {
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS: {
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

            case ReverseEdgeMultipleCreationInputAction.CREATE_SOME: {
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
