import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { RequireExactlyOne } from 'type-fest';
import type {
  Edge,
  EdgeValue,
} from '../../../../../definition/component/edge.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractComponentCreationInput } from '../abstract-component.js';

export enum EdgeCreationInputAction {
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
}

export type EdgeCreationInputValue = utils.Nillable<
  RequireExactlyOne<{
    [EdgeCreationInputAction.CONNECT]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CONNECT_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CONNECT_OR_CREATE]: utils.NonNillable<{
      where: utils.NonNillable<NodeUniqueFilterInputValue>;
      create: utils.NonNillable<NodeCreationInputValue>;
    }>;
    [EdgeCreationInputAction.CREATE]: utils.NonNillable<NodeCreationInputValue>;
  }>
>;

export type EdgeCreationInputConfig = Omit<
  utils.InputConfig<EdgeCreationInputValue>,
  'name' | 'type' | 'publicType'
>;

export class EdgeCreationInput extends AbstractComponentCreationInput<EdgeCreationInputValue> {
  public constructor(public readonly edge: Edge) {
    super(
      edge,
      {
        type: new utils.ObjectInputType({
          name: [
            edge.tail.name,
            'Nested',
            edge.pascalCasedName,
            'Edge',
            inflection.camelize(utils.MutationType.CREATION),
            'Input',
          ].join(''),
          fields: () => {
            const fields: utils.Input[] = [
              new utils.Input({
                name: EdgeCreationInputAction.CONNECT,
                description: `Connect ${edge.head.indefinite} to this new "${edge.tail}" through the "${edge}" edge, throw an error if it does not exist.`,
                type: edge.head.uniqueFilterInputType,
                nullable: false,
              }),
            ];

            if (edge.isNullable()) {
              fields.push(
                new utils.Input({
                  name: EdgeCreationInputAction.CONNECT_IF_EXISTS,
                  description: `Connect ${edge.head.indefinite} to this new "${edge.tail}" through the "${edge}" edge, if it exists.`,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
              );
            }

            if (edge.head.isMutationEnabled(utils.MutationType.CREATION)) {
              fields.push(
                new utils.Input({
                  name: EdgeCreationInputAction.CREATE,
                  description: `Create ${edge.head.indefinite} and connect it to this new "${edge.tail}" through the "${edge}" edge.`,
                  type: edge.head.creationInputType,
                  nullable: false,
                  public: edge.head.isMutationPublic(
                    utils.MutationType.CREATION,
                  ),
                }),
                new utils.Input({
                  name: EdgeCreationInputAction.CONNECT_OR_CREATE,
                  description: `Create ${edge.head.indefinite} if it does not exist, and connect it to this new "${edge.tail}" through the "${edge}" edge.`,
                  type: new utils.ObjectInputType({
                    name: [
                      edge.tail.name,
                      'Nested',
                      inflection.camelize(
                        EdgeCreationInputAction.CONNECT_OR_CREATE,
                      ),
                      edge.pascalCasedName,
                      'Edge',
                      inflection.camelize(utils.MutationType.CREATION),
                      'Input',
                    ].join(''),
                    fields: () => [
                      new utils.Input({
                        name: 'where',
                        type: utils.nonNillableInputType(
                          edge.head.uniqueFilterInputType,
                        ),
                      }),
                      new utils.Input({
                        name: 'create',
                        type: utils.nonNillableInputType(
                          edge.head.creationInputType,
                        ),
                      }),
                    ],
                  }),
                  nullable: false,
                  public: edge.head.isMutationPublic(
                    utils.MutationType.CREATION,
                  ),
                }),
              );
            }

            return fields;
          },
        }),
        assertValue(inputValue, path) {
          if (Object.keys(inputValue).length !== 1) {
            throw new utils.UnexpectedValueError(
              `one and only one action`,
              inputValue,
              { path },
            );
          }
        },
        ...edge.config[utils.MutationType.CREATION],
      },
      utils.addPath(edge.configPath, utils.MutationType.CREATION),
    );
  }

  public override async resolveComponentValue(
    inputValue: Readonly<utils.NonNillable<EdgeCreationInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<EdgeValue | undefined> {
    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = Object.keys(inputValue)[0] as EdgeCreationInputAction;
    const actionPath = utils.addPath(path, actionName);

    switch (actionName) {
      case EdgeCreationInputAction.CONNECT: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQueryByKey('get-one')
          .execute(
            { where: actionData, selection },
            context,
            actionPath,
          ) as any;
      }

      case EdgeCreationInputAction.CONNECT_IF_EXISTS: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQueryByKey('get-one-if-exists')
          .execute(
            { where: actionData, selection },
            context,
            actionPath,
          ) as any;
      }

      case EdgeCreationInputAction.CONNECT_OR_CREATE: {
        const actionData = inputValue[actionName]!;

        return (
          (await this.edge.head
            .getQueryByKey('get-one-if-exists')
            .execute(
              { where: actionData.where, selection },
              context,
              actionPath,
            )) ??
          ((await this.edge.head
            .getMutationByKey('create-one')
            .execute(
              { data: actionData.create, selection },
              context,
              actionPath,
            )) as any)
        );
      }

      case EdgeCreationInputAction.CREATE: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getMutationByKey('create-one')
          .execute({ data: actionData, selection }, context, actionPath) as any;
      }

      default:
        throw new utils.UnreachableValueError(actionName, {
          path,
        });
    }
  }
}
