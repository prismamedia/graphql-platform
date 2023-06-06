import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum MultipleReverseEdgeCreationInputAction {
  CREATE_SOME = 'create',
}

export type MultipleReverseEdgeCreationInputValue = utils.Optional<
  Partial<{
    [MultipleReverseEdgeCreationInputAction.CREATE_SOME]: ReadonlyArray<
      NonNullable<NodeCreationInputValue>
    >;
  }>
>;

export class MultipleReverseEdgeCreationInput extends AbstractReverseEdgeCreationInput<MultipleReverseEdgeCreationInputValue> {
  public static supports(reverseEdge: MultipleReverseEdge): boolean {
    return reverseEdge.head.isCreatable();
  }

  public constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
  ) {
    assert(
      MultipleReverseEdgeCreationInput.supports(reverseEdge),
      `The "${reverseEdge}" reverse-edge is not available at creation`,
    );

    super(reverseEdge, {
      type: new utils.ObjectInputType({
        name: [
          reverseEdge.tail.name,
          inflection.camelize(utils.MutationType.CREATION),
          reverseEdge.pascalCasedName,
          'Input',
        ].join(''),
        fields: () => {
          const fields: utils.Input[] = [];

          if (reverseEdge.head.isCreatable()) {
            fields.push(
              new utils.Input({
                name: MultipleReverseEdgeCreationInputAction.CREATE_SOME,
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
    const headAPI = this.reverseEdge.head.createContextBoundAPI(context);

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
            case MultipleReverseEdgeCreationInputAction.CREATE_SOME: {
              const actionData = inputValue[actionName]!;

              await headAPI.createSome(
                {
                  data: actionData.map((data) => ({
                    ...data,
                    [originalEdgeName]: {
                      [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                    },
                  })),
                  selection,
                },
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
