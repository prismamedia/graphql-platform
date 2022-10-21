import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { RequireExactlyOne } from 'type-fest';
import type {
  Edge,
  EdgeUpdate,
} from '../../../../../definition/component/edge.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractComponentUpdateInput } from '../abstract-component.js';

export enum EdgeUpdateInputAction {
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CONNECT_OR_CREATE = 'connectOrCreate',
  CREATE = 'create',
  DISCONNECT = 'disconnect',
}

export type EdgeUpdateInputValue = utils.Nillable<
  RequireExactlyOne<{
    [EdgeUpdateInputAction.CONNECT]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CONNECT_IF_EXISTS]: utils.NonNillable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CONNECT_OR_CREATE]: utils.NonNillable<{
      where: utils.NonNillable<NodeUniqueFilterInputValue>;
      create: utils.NonNillable<NodeCreationInputValue>;
    }>;
    [EdgeUpdateInputAction.CREATE]: utils.NonNillable<NodeCreationInputValue>;
    [EdgeUpdateInputAction.DISCONNECT]: boolean;
  }>
>;

export type EdgeUpdateInputConfig = Omit<
  utils.InputConfig<EdgeUpdateInputValue>,
  'name' | 'optional' | 'type' | 'publicType'
>;

export class EdgeUpdateInput extends AbstractComponentUpdateInput<EdgeUpdateInputValue> {
  public constructor(public readonly edge: Edge) {
    super(
      edge,
      {
        type: utils.nonNullableInputTypeDecorator(
          new utils.ObjectInputType({
            name: [
              edge.tail.name,
              'Nested',
              edge.pascalCasedName,
              'Edge',
              inflection.camelize(utils.MutationType.UPDATE),
              'Input',
            ].join(''),
            fields: () => {
              const fields: utils.Input[] = [
                new utils.Input({
                  name: EdgeUpdateInputAction.CONNECT,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
              ];

              if (edge.isNullable()) {
                fields.push(
                  new utils.Input({
                    name: EdgeUpdateInputAction.CONNECT_IF_EXISTS,
                    type: edge.head.uniqueFilterInputType,
                    nullable: false,
                  }),
                );
              }

              if (edge.head.isMutationEnabled(utils.MutationType.CREATION)) {
                fields.push(
                  new utils.Input({
                    name: EdgeUpdateInputAction.CONNECT_OR_CREATE,
                    type: new utils.ObjectInputType({
                      name: [
                        edge.tail.name,
                        'Nested',
                        inflection.camelize(
                          EdgeUpdateInputAction.CONNECT_OR_CREATE,
                        ),
                        edge.pascalCasedName,
                        'Edge',
                        inflection.camelize(utils.MutationType.UPDATE),
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
                  new utils.Input({
                    name: EdgeUpdateInputAction.CREATE,
                    type: edge.head.creationInputType,
                    nullable: false,
                    public: edge.head.isMutationPublic(
                      utils.MutationType.CREATION,
                    ),
                  }),
                );
              }

              if (edge.isNullable()) {
                fields.push(
                  new utils.Input({
                    name: EdgeUpdateInputAction.DISCONNECT,
                    type: scalars.typesByName.Boolean,
                    nullable: false,
                  }),
                );
              }

              return fields;
            },
          }),
          !edge.isNullable(),
        ),
        parser(inputValue, path) {
          if (Object.keys(inputValue).length !== 1) {
            throw new utils.UnexpectedValueError(
              `one and only one action`,
              inputValue,
              { path },
            );
          }

          return inputValue;
        },
        ...edge.config[utils.MutationType.UPDATE],
      },
      utils.addPath(edge.configPath, utils.MutationType.UPDATE),
    );
  }

  public override async resolveComponentUpdate(
    inputValue: Readonly<utils.NonNillable<EdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<EdgeUpdate | undefined> {
    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = Object.keys(inputValue)[0] as EdgeUpdateInputAction;
    const actionPath = utils.addPath(path, actionName);

    switch (actionName) {
      case EdgeUpdateInputAction.CONNECT: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQueryByKey('get-one')
          .execute(
            { where: actionData, selection },
            context,
            actionPath,
          ) as any;
      }

      case EdgeUpdateInputAction.CONNECT_IF_EXISTS: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQueryByKey('get-one-if-exists')
          .execute(
            { where: actionData, selection },
            context,
            actionPath,
          ) as any;
      }

      case EdgeUpdateInputAction.CONNECT_OR_CREATE: {
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

      case EdgeUpdateInputAction.CREATE: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getMutationByKey('create-one')
          .execute({ data: actionData, selection }, context, actionPath) as any;
      }

      case EdgeUpdateInputAction.DISCONNECT: {
        const actionData = inputValue[actionName]!;

        return actionData === true ? null : undefined;
      }

      default:
        throw new utils.UnreachableValueError(actionName, { path });
    }
  }
}
