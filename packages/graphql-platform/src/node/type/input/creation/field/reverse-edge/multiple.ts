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
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeFilterInputValue } from '../../../filter.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum ReverseEdgeMultipleCreationInputAction {
  CONNECT_MANY = 'connectMany',
  CONNECT_OR_CREATE_SOME = 'connectOrCreateSome',
  CONNECT_SOME = 'connectSome',
  CONNECT_SOME_IF_EXISTS = 'connectSomeIfExists',
  CREATE_SOME = 'createSome',
}

export type ReverseEdgeMultipleCreationInputValue = Optional<
  Partial<{
    [ReverseEdgeMultipleCreationInputAction.CONNECT_MANY]: NonNillable<NodeFilterInputValue>;
    [ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>[];
    [ReverseEdgeMultipleCreationInputAction.CONNECT_SOME]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>[];
    [ReverseEdgeMultipleCreationInputAction.CREATE_SOME]: NonNillable<NodeCreationInputValue>[];
  }>
>;

export class ReverseEdgeMultipleCreationInput extends AbstractReverseEdgeCreationInput<ReverseEdgeMultipleCreationInputValue> {
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
          inflection.camelize(MutationType.CREATION),
          'Input',
        ].join(''),
        fields: () => {
          const fields: Input[] = [];

          if (
            reverseEdge.head.isMutationEnabled(MutationType.UPDATE) &&
            reverseEdge.originalEdge.isMutable()
          ) {
            fields.push(
              new Input({
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_MANY,
                type: new NonNullableInputType(
                  reverseEdge.head.filterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
            );

            if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
              fields.push(
                new Input({
                  name: ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME,
                  type: new NonNullableInputType(
                    new ListableInputType(
                      nonNillableInputType(
                        new ObjectInputType({
                          name: [
                            reverseEdge.tail.name,
                            'Nested',
                            inflection.camelize(
                              ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME,
                            ),
                            reverseEdge.pascalCasedName,
                            'ReverseEdge',
                            inflection.camelize(MutationType.CREATION),
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
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_SOME,
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
                name: ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS,
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
                name: ReverseEdgeMultipleCreationInputAction.CREATE_SOME,
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
    inputValue: Readonly<NonNillable<ReverseEdgeMultipleCreationInputValue>>,
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

    await Promise.all(
      (Object.keys(inputValue) as ReverseEdgeMultipleCreationInputAction[]).map(
        async (actionName) => {
          const actionPath = addPath(path, actionName);

          switch (actionName) {
            case ReverseEdgeMultipleCreationInputAction.CONNECT_MANY: {
              const actionData = inputValue[actionName]!;

              await this.reverseEdge.head
                .getMutationByKey('update-many')
                .execute(
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_OR_CREATE_SOME: {
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_SOME: {
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

            case ReverseEdgeMultipleCreationInputAction.CONNECT_SOME_IF_EXISTS: {
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

            case ReverseEdgeMultipleCreationInputAction.CREATE_SOME: {
              const actionData = inputValue[actionName]!;

              await this.reverseEdge.head
                .getMutationByKey('create-some')
                .execute(
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
        },
      ),
    );
  }
}
