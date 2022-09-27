import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { RequireExactlyOne } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum ReverseEdgeUniqueCreationInputAction {
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
}

export type ReverseEdgeUniqueCreationInputValue = utils.Optional<
  RequireExactlyOne<{
    [ReverseEdgeUniqueCreationInputAction.CONNECT]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE]: utils.NonNillable<{
      where: utils.NonNillable<NodeUniqueFilterInputValue>;
      create: utils.NonNillable<NodeCreationInputValue>;
    }>;
    [ReverseEdgeUniqueCreationInputAction.CREATE]: utils.NonNillable<NodeCreationInputValue>;
  }>
>;

export class ReverseEdgeUniqueCreationInput extends AbstractReverseEdgeCreationInput<ReverseEdgeUniqueCreationInputValue> {
  public constructor(public override readonly reverseEdge: ReverseEdgeUnique) {
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
                name: ReverseEdgeUniqueCreationInputAction.CONNECT,
                type: new utils.NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(
                  utils.MutationType.UPDATE,
                ),
              }),
              new utils.Input({
                name: ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS,
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
                  name: ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE,
                  type: new utils.NonNullableInputType(
                    new utils.ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        'Nested',
                        inflection.camelize(
                          ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE,
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
                name: ReverseEdgeUniqueCreationInputAction.CREATE,
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
      validateValue(inputValue, path) {
        if (inputValue) {
          if (Object.keys(inputValue).length > 1) {
            throw new utils.UnexpectedValueError(
              `at most one action`,
              inputValue,
              {
                path,
              },
            );
          }
        }
      },
    });
  }

  public override async applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<
      utils.NonNillable<ReverseEdgeUniqueCreationInputValue>
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

    const maybeActionName = Object.keys(
      inputValue,
    )[0] as ReverseEdgeUniqueCreationInputAction;
    const actionPath = utils.addPath(path, maybeActionName);

    switch (maybeActionName) {
      case ReverseEdgeUniqueCreationInputAction.CONNECT: {
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

      case ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS: {
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

      case ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE: {
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

      case ReverseEdgeUniqueCreationInputAction.CREATE: {
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
