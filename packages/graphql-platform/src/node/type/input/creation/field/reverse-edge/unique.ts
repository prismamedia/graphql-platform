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
import type { RequireExactlyOne } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum ReverseEdgeUniqueCreationInputAction {
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
}

export type ReverseEdgeUniqueCreationInputValue = Optional<
  RequireExactlyOne<{
    [ReverseEdgeUniqueCreationInputAction.CONNECT]: NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>;
    [ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>;
    [ReverseEdgeUniqueCreationInputAction.CREATE]: NonNillable<NodeCreationInputValue>;
  }>
>;

export class ReverseEdgeUniqueCreationInput extends AbstractReverseEdgeCreationInput<ReverseEdgeUniqueCreationInputValue> {
  public constructor(public override readonly reverseEdge: ReverseEdgeUnique) {
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
                name: ReverseEdgeUniqueCreationInputAction.CONNECT,
                type: new NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
              new Input({
                name: ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS,
                type: new NonNullableInputType(
                  reverseEdge.head.uniqueFilterInputType,
                ),
                public: reverseEdge.head.isMutationPublic(MutationType.UPDATE),
              }),
            );

            if (reverseEdge.head.isMutationEnabled(MutationType.CREATION)) {
              fields.push(
                new Input({
                  name: ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE,
                  type: new NonNullableInputType(
                    new ObjectInputType({
                      name: [
                        reverseEdge.tail.name,
                        'Nested',
                        inflection.camelize(
                          ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE,
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
                name: ReverseEdgeUniqueCreationInputAction.CREATE,
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
          if (Object.keys(inputValue).length > 1) {
            throw new UnexpectedValueError(`at most one action`, inputValue, {
              path,
            });
          }
        }
      },
    });
  }

  public override async applyActions(
    nodeValue: Readonly<NodeValue>,
    inputValue: Readonly<NonNillable<ReverseEdgeUniqueCreationInputValue>>,
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

    const maybeActionName = Object.keys(
      inputValue,
    )[0] as ReverseEdgeUniqueCreationInputAction;
    const actionPath = addPath(path, maybeActionName);

    switch (maybeActionName) {
      case ReverseEdgeUniqueCreationInputAction.CONNECT: {
        const actionData = inputValue[maybeActionName]!;

        await this.reverseEdge.head.getMutationByKey('update-one').execute(
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

      case ReverseEdgeUniqueCreationInputAction.CONNECT_IF_EXISTS: {
        const actionData = inputValue[maybeActionName]!;

        await this.reverseEdge.head
          .getMutationByKey('update-one-if-exists')
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

      case ReverseEdgeUniqueCreationInputAction.CONNECT_OR_CREATE: {
        const { where, create } = inputValue[maybeActionName]!;

        await this.reverseEdge.head.getMutationByKey('upsert').execute(
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

      case ReverseEdgeUniqueCreationInputAction.CREATE: {
        const actionData = inputValue[maybeActionName]!;

        await this.reverseEdge.head
          .getMutationByKey('create-one')
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
