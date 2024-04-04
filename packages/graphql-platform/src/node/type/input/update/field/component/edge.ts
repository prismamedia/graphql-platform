import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { Except, RequireExactlyOne } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import type {
  Edge,
  ReferenceValue,
} from '../../../../../definition/component/edge.js';
import { UniqueConstraintValue } from '../../../../../definition/unique-constraint.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { EdgeUpdateValue } from '../../../../../statement/update.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import type { NodeUpdateInputValue } from '../../../update.js';
import { AbstractComponentUpdateInput } from '../abstract-component.js';

export enum EdgeUpdateInputAction {
  DISCONNECT = 'disconnect',
  DISCONNECT_IF_EXISTS = 'disconnectIfExists',
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CREATE = 'create',
  CREATE_IF_NOT_EXISTS = 'createIfNotExists',
  UPDATE = 'update',
  UPDATE_IF_EXISTS = 'updateIfExists',
}

export type EdgeUpdateInputValue = utils.Nillable<
  RequireExactlyOne<{
    [EdgeUpdateInputAction.DISCONNECT]: boolean;
    [EdgeUpdateInputAction.DISCONNECT_IF_EXISTS]: boolean;
    [EdgeUpdateInputAction.CONNECT]: NonNullable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CONNECT_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>;
    [EdgeUpdateInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
    [EdgeUpdateInputAction.CREATE_IF_NOT_EXISTS]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      data: NonNullable<NodeCreationInputValue>;
    }>;
    [EdgeUpdateInputAction.UPDATE]: NonNullable<NodeUpdateInputValue>;
    [EdgeUpdateInputAction.UPDATE_IF_EXISTS]: NonNullable<NodeUpdateInputValue>;
  }>
>;

export type EdgeUpdateInputConfig = Except<
  utils.InputConfig<EdgeUpdateInputValue>,
  'name' | 'optional' | 'type' | 'publicType'
>;

export class EdgeUpdateInput extends AbstractComponentUpdateInput<EdgeUpdateInputValue> {
  public constructor(public readonly edge: Edge) {
    const config = edge.config[utils.MutationType.UPDATE];
    const configPath = utils.addPath(
      edge.configPath,
      utils.MutationType.UPDATE,
    );

    super(
      edge,
      {
        type: new utils.ObjectInputType({
          name: [
            edge.tail.name,
            inflection.camelize(utils.MutationType.UPDATE),
            edge.pascalCasedName,
            'Input',
          ].join(''),
          fields: () => {
            const fields: utils.Input[] = [
              new utils.Input({
                name: EdgeUpdateInputAction.CONNECT,
                description: `Connect ${edge.head.indefinite} to an existing "${edge.tail}" through the "${edge}" edge, throw an error if it does not exist.`,
                type: edge.head.uniqueFilterInputType,
                nullable: false,
              }),
            ];

            if (edge.isNullable()) {
              fields.push(
                new utils.Input({
                  name: EdgeUpdateInputAction.CONNECT_IF_EXISTS,
                  description: `Connect ${edge.head.indefinite} to an existing "${edge.tail}" through the "${edge}" edge, if it exists.`,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
                new utils.Input({
                  name: EdgeUpdateInputAction.DISCONNECT,
                  type: scalars.typesByName.Boolean,
                  nullable: false,
                }),
                new utils.Input({
                  name: EdgeUpdateInputAction.DISCONNECT_IF_EXISTS,
                  type: scalars.typesByName.Boolean,
                  nullable: false,
                }),
              );
            }

            if (edge.head.isCreatable()) {
              fields.push(
                new utils.Input({
                  name: EdgeUpdateInputAction.CREATE,
                  description: `Create ${edge.head.indefinite} and connect it to an existing "${edge.tail}" through the "${edge}" edge.`,
                  type: edge.head.creationInputType,
                  nullable: false,
                }),
                new utils.Input({
                  name: EdgeUpdateInputAction.CREATE_IF_NOT_EXISTS,
                  description: `Create ${edge.head.indefinite} if it does not exist, and connect it to an existing "${edge.tail}" through the "${edge}" edge.`,
                  type: new utils.ObjectInputType({
                    name: [
                      edge.tail.name,
                      inflection.camelize(utils.MutationType.UPDATE),
                      edge.pascalCasedName,
                      inflection.camelize(
                        EdgeUpdateInputAction.CREATE_IF_NOT_EXISTS,
                      ),
                      'Input',
                    ].join(''),
                    fields: () =>
                      edge.head.getMutationByKey('create-one-if-not-exists')
                        .arguments,
                  }),
                  nullable: false,
                }),
              );
            }

            if (edge.head.isUpdatable()) {
              fields.push(
                new utils.Input({
                  name: EdgeUpdateInputAction.UPDATE,
                  description: `Update the connected "${edge.head}", throw an error if the "${edge}" edge does not exist.`,
                  type: edge.head.updateInputType,
                  nullable: false,
                }),
              );

              if (edge.isNullable()) {
                fields.push(
                  new utils.Input({
                    name: EdgeUpdateInputAction.UPDATE_IF_EXISTS,
                    description: `Update the connected "${edge.head}", if the "${edge}" edge exists.`,
                    type: edge.head.updateInputType,
                    nullable: false,
                  }),
                );
              }
            }

            return fields;
          },
        }),
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
        ...config,
      },
      configPath,
    );
  }

  public async resolveUpdate(
    currentValues: ReadonlyArray<NodeValue>,
    inputValue: Readonly<NonNullable<EdgeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<EdgeUpdateValue> {
    const headAPI = this.edge.head.createContextBoundAPI(context);

    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = (Object.keys(inputValue) as EdgeUpdateInputAction[]).at(
      0,
    );

    if (actionName) {
      const actionPath = utils.addPath(path, actionName);

      switch (actionName) {
        case EdgeUpdateInputAction.DISCONNECT:
        case EdgeUpdateInputAction.DISCONNECT_IF_EXISTS: {
          const actionData = inputValue[actionName]!;

          if (actionData === true) {
            if (
              actionName === EdgeUpdateInputAction.DISCONNECT &&
              currentValues.some(
                (currentValue) => !currentValue[this.edge.name],
              )
            ) {
              throw new utils.GraphError(
                `The "${this.edge.tail.plural}" is not connected to any "${this.edge.head.plural}"`,
                { path: actionPath },
              );
            }

            return null;
          }

          return undefined;
        }

        case EdgeUpdateInputAction.CONNECT: {
          const where = inputValue[actionName]!;

          return headAPI.getOne({ where, selection }, actionPath);
        }

        case EdgeUpdateInputAction.CONNECT_IF_EXISTS: {
          const where = inputValue[actionName]!;

          return headAPI.getOneIfExists({ where, selection }, actionPath);
        }

        case EdgeUpdateInputAction.CREATE: {
          const data = inputValue[actionName]!;

          return headAPI.createOne({ data, selection }, actionPath);
        }

        case EdgeUpdateInputAction.CREATE_IF_NOT_EXISTS: {
          const { where, data } = inputValue[actionName]!;

          return headAPI.createOneIfNotExists(
            { where, data, selection },
            actionPath,
          );
        }

        case EdgeUpdateInputAction.UPDATE:
        case EdgeUpdateInputAction.UPDATE_IF_EXISTS: {
          const data = inputValue[actionName]!;

          const references: UniqueConstraintValue[] = [];

          for (const currentValue of currentValues) {
            const reference: ReferenceValue = currentValue[this.edge.name];
            if (reference) {
              references.push(reference);
            } else if (actionName === EdgeUpdateInputAction.UPDATE) {
              throw new utils.GraphError(
                `The "${this.edge.tail.plural}" is not connected to any "${this.edge.head.plural}"`,
                { path: actionPath },
              );
            }
          }

          if (references.length) {
            await headAPI.updateMany(
              {
                where: { OR: references },
                first: references.length,
                data,
                selection,
              },
              actionPath,
            );
          }

          return undefined;
        }

        default:
          throw new utils.UnreachableValueError(actionName, { path });
      }
    }
  }
}
