import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { RequireExactlyOne } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../definition/reverse-edge/unique.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import { EdgeUpdateInputAction } from '../../../update/field/component/edge.js';
import { AbstractReverseEdgeCreationInput } from '../abstract-reverse-edge.js';

export enum UniqueReverseEdgeCreationInputAction {
  CREATE = 'create',
}

export type UniqueReverseEdgeCreationInputValue = utils.Optional<
  RequireExactlyOne<{
    [UniqueReverseEdgeCreationInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
  }>
>;

export class UniqueReverseEdgeCreationInput extends AbstractReverseEdgeCreationInput<UniqueReverseEdgeCreationInputValue> {
  public static supports(reverseEdge: UniqueReverseEdge): boolean {
    return reverseEdge.head.isCreatable();
  }

  public constructor(public override readonly reverseEdge: UniqueReverseEdge) {
    assert(
      UniqueReverseEdgeCreationInput.supports(reverseEdge),
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
                name: UniqueReverseEdgeCreationInputAction.CREATE,
                type: reverseEdge.head.getCreationWithoutEdgeInputType(
                  reverseEdge.originalEdge,
                ),
                nullable: false,
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
    const headAPI = this.reverseEdge.head.createContextBoundAPI(context);

    const originalEdge = this.reverseEdge.originalEdge;
    const originalEdgeName = originalEdge.name;
    const originalEdgeValue =
      originalEdge.referencedUniqueConstraint.parseValue(nodeValue, path);
    const selection = this.reverseEdge.head.mainIdentifier.selection;

    const maybeActionName = (
      Object.keys(inputValue) as UniqueReverseEdgeCreationInputAction[]
    ).at(0);

    if (maybeActionName) {
      const actionPath = utils.addPath(path, maybeActionName);

      switch (maybeActionName) {
        case UniqueReverseEdgeCreationInputAction.CREATE: {
          const data = inputValue[maybeActionName]!;

          await headAPI.createOne(
            {
              data: {
                ...data,
                [originalEdgeName]: {
                  [EdgeUpdateInputAction.CONNECT]: originalEdgeValue,
                },
              },
              selection,
            },
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
}
