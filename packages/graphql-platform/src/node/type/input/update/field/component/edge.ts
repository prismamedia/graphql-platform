import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  MutationType,
  nonNillableInputType,
  nonNullableInputTypeDecorator,
  ObjectInputType,
  UnexpectedValueError,
  UnreachableValueError,
  type InputConfig,
  type Nillable,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
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

export type EdgeUpdateInputValue = Nillable<
  RequireExactlyOne<{
    [EdgeUpdateInputAction.CONNECT]: NonNillable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CONNECT_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CONNECT_OR_CREATE]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>;
    [EdgeUpdateInputAction.CREATE]: NonNillable<NodeCreationInputValue>;
    [EdgeUpdateInputAction.DISCONNECT]: boolean;
  }>
>;

export type EdgeUpdateInputConfig = Omit<
  InputConfig<EdgeUpdateInputValue>,
  'name' | 'optional' | 'type' | 'publicType'
>;

export class EdgeUpdateInput extends AbstractComponentUpdateInput<EdgeUpdateInputValue> {
  public constructor(public readonly edge: Edge) {
    super(
      edge,
      {
        type: nonNullableInputTypeDecorator(
          new ObjectInputType({
            name: [
              edge.tail.name,
              'Nested',
              edge.pascalCasedName,
              'Edge',
              inflection.camelize(MutationType.UPDATE),
              'Input',
            ].join(''),
            fields: () => {
              const fields: Input[] = [
                new Input({
                  name: EdgeUpdateInputAction.CONNECT,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
              ];

              if (edge.isNullable()) {
                fields.push(
                  new Input({
                    name: EdgeUpdateInputAction.CONNECT_IF_EXISTS,
                    type: edge.head.uniqueFilterInputType,
                    nullable: false,
                  }),
                );
              }

              if (edge.head.isMutationEnabled(MutationType.CREATION)) {
                fields.push(
                  new Input({
                    name: EdgeUpdateInputAction.CONNECT_OR_CREATE,
                    type: new ObjectInputType({
                      name: [
                        edge.tail.name,
                        'Nested',
                        inflection.camelize(
                          EdgeUpdateInputAction.CONNECT_OR_CREATE,
                        ),
                        edge.pascalCasedName,
                        'Edge',
                        inflection.camelize(MutationType.UPDATE),
                        'Input',
                      ].join(''),
                      fields: () => [
                        new Input({
                          name: 'where',
                          type: nonNillableInputType(
                            edge.head.uniqueFilterInputType,
                          ),
                        }),
                        new Input({
                          name: 'create',
                          type: nonNillableInputType(
                            edge.head.creationInputType,
                          ),
                        }),
                      ],
                    }),
                    nullable: false,
                    public: edge.head.isMutationPublic(MutationType.CREATION),
                  }),
                  new Input({
                    name: EdgeUpdateInputAction.CREATE,
                    type: edge.head.creationInputType,
                    nullable: false,
                    public: edge.head.isMutationPublic(MutationType.CREATION),
                  }),
                );
              }

              if (edge.isNullable()) {
                fields.push(
                  new Input({
                    name: EdgeUpdateInputAction.DISCONNECT,
                    type: Scalars.Boolean,
                    nullable: false,
                  }),
                );
              }

              return fields;
            },
          }),
          !edge.isNullable(),
        ),
        validateValue(inputValue, path) {
          if (inputValue) {
            if (Object.keys(inputValue).length !== 1) {
              throw new UnexpectedValueError(
                `one and only one action`,
                inputValue,
                { path },
              );
            }
          }
        },
        ...edge.config[MutationType.UPDATE],
      },
      addPath(edge.configPath, MutationType.UPDATE),
    );
  }

  public override async resolveComponentUpdate(
    inputValue: Readonly<NonNillable<EdgeUpdateInputValue>>,
    context: MutationContext,
    path: Path,
  ): Promise<EdgeUpdate | undefined> {
    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = Object.keys(inputValue)[0] as EdgeUpdateInputAction;
    const actionPath = addPath(path, actionName);

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
        throw new UnreachableValueError(actionName, { path });
    }
  }
}
