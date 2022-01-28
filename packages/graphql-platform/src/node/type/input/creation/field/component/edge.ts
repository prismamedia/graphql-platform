import {
  addPath,
  Input,
  MutationType,
  nonNillableInputType,
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

export type EdgeCreationInputValue = Nillable<
  RequireExactlyOne<{
    [EdgeCreationInputAction.CONNECT]: NonNillable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CONNECT_IF_EXISTS]: NonNillable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CONNECT_OR_CREATE]: NonNillable<{
      where: NonNillable<NodeUniqueFilterInputValue>;
      create: NonNillable<NodeCreationInputValue>;
    }>;
    [EdgeCreationInputAction.CREATE]: NonNillable<NodeCreationInputValue>;
  }>
>;

export type EdgeCreationInputConfig = Omit<
  InputConfig<EdgeCreationInputValue>,
  'name' | 'type' | 'publicType'
>;

export class EdgeCreationInput extends AbstractComponentCreationInput<EdgeCreationInputValue> {
  public constructor(public readonly edge: Edge) {
    super(
      edge,
      {
        type: new ObjectInputType({
          name: [
            edge.tail.name,
            'Nested',
            edge.pascalCasedName,
            'Edge',
            inflection.camelize(MutationType.CREATION),
            'Input',
          ].join(''),
          fields: () => {
            const fields: Input[] = [
              new Input({
                name: EdgeCreationInputAction.CONNECT,
                description: `Connect ${edge.head.indefinite} to this new "${edge.tail}" through the "${edge}" edge, throw an error if it does not exist.`,
                type: edge.head.uniqueFilterInputType,
                nullable: false,
              }),
            ];

            if (edge.isNullable()) {
              fields.push(
                new Input({
                  name: EdgeCreationInputAction.CONNECT_IF_EXISTS,
                  description: `Connect ${edge.head.indefinite} to this new "${edge.tail}" through the "${edge}" edge, if it exists.`,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
              );
            }

            if (edge.head.isMutationEnabled(MutationType.CREATION)) {
              fields.push(
                new Input({
                  name: EdgeCreationInputAction.CREATE,
                  description: `Create ${edge.head.indefinite} and connect it to this new "${edge.tail}" through the "${edge}" edge.`,
                  type: edge.head.creationInputType,
                  nullable: false,
                  public: edge.head.isMutationPublic(MutationType.CREATION),
                }),
                new Input({
                  name: EdgeCreationInputAction.CONNECT_OR_CREATE,
                  description: `Create ${edge.head.indefinite} if it does not exist, and connect it to this new "${edge.tail}" through the "${edge}" edge.`,
                  type: new ObjectInputType({
                    name: [
                      edge.tail.name,
                      'Nested',
                      inflection.camelize(
                        EdgeCreationInputAction.CONNECT_OR_CREATE,
                      ),
                      edge.pascalCasedName,
                      'Edge',
                      inflection.camelize(MutationType.CREATION),
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
                        type: nonNillableInputType(edge.head.creationInputType),
                      }),
                    ],
                  }),
                  nullable: false,
                  public: edge.head.isMutationPublic(MutationType.CREATION),
                }),
              );
            }

            return fields;
          },
        }),
        validateValue(inputValue, path) {
          if (inputValue != null) {
            if (Object.keys(inputValue).length !== 1) {
              throw new UnexpectedValueError(
                `one and only one action`,
                inputValue,
                { path },
              );
            }
          }
        },
        ...edge.config[MutationType.CREATION],
      },
      addPath(edge.configPath, MutationType.CREATION),
    );
  }

  public override async resolveComponentValue(
    inputValue: Readonly<NonNillable<EdgeCreationInputValue>>,
    context: MutationContext,
    path: Path,
  ): Promise<EdgeValue | undefined> {
    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = Object.keys(inputValue)[0] as EdgeCreationInputAction;
    const actionPath = addPath(path, actionName);

    switch (actionName) {
      case EdgeCreationInputAction.CONNECT: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQuery('get-one')
          .execute(
            { where: actionData, selection },
            context,
            actionPath,
          ) as any;
      }

      case EdgeCreationInputAction.CONNECT_IF_EXISTS: {
        const actionData = inputValue[actionName]!;

        return this.edge.head
          .getQuery('get-one-if-exists')
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
            .getQuery('get-one-if-exists')
            .execute(
              { where: actionData.where, selection },
              context,
              actionPath,
            )) ??
          ((await this.edge.head
            .getMutation('create-one')
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
          .getMutation('create-one')
          .execute({ data: actionData, selection }, context, actionPath) as any;
      }

      default:
        throw new UnreachableValueError(actionName, { path });
    }
  }
}
