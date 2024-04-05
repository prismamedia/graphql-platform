import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type { Except, RequireExactlyOne } from 'type-fest';
import type {
  Edge,
  ReferenceValue,
} from '../../../../../definition/component/edge.js';
import type { MutationContext } from '../../../../../operation/mutation/context.js';
import type { EdgeCreationValue } from '../../../../../statement/creation.js';
import type { NodeCreationInputValue } from '../../../creation.js';
import type { NodeUniqueFilterInputValue } from '../../../unique-filter.js';
import { AbstractComponentCreationInput } from '../abstract-component.js';

export enum EdgeCreationInputAction {
  REFERENCE = 'reference',
  CONNECT = 'connect',
  CONNECT_IF_EXISTS = 'connectIfExists',
  CREATE = 'create',
  CREATE_IF_NOT_EXISTS = 'createIfNotExists',
}

export type EdgeCreationInputValue = utils.Nillable<
  RequireExactlyOne<{
    [EdgeCreationInputAction.REFERENCE]: NonNullable<ReferenceValue>;
    [EdgeCreationInputAction.CONNECT]: NonNullable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CONNECT_IF_EXISTS]: NonNullable<NodeUniqueFilterInputValue>;
    [EdgeCreationInputAction.CREATE]: NonNullable<NodeCreationInputValue>;
    [EdgeCreationInputAction.CREATE_IF_NOT_EXISTS]: NonNullable<{
      where: NonNullable<NodeUniqueFilterInputValue>;
      data: NonNullable<NodeCreationInputValue>;
    }>;
  }>
>;

export type EdgeCreationInputConfig = Except<
  utils.InputConfig<EdgeCreationInputValue>,
  'name' | 'type' | 'publicType'
>;

export class EdgeCreationInput extends AbstractComponentCreationInput<EdgeCreationInputValue> {
  public constructor(public readonly edge: Edge) {
    const config = edge.config[utils.MutationType.CREATION];
    const configPath = utils.addPath(
      edge.configPath,
      utils.MutationType.CREATION,
    );

    super(
      edge,
      {
        type: new utils.ObjectInputType({
          name: [
            edge.tail.name,
            inflection.camelize(utils.MutationType.CREATION),
            edge.pascalCasedName,
            'Input',
          ].join(''),
          fields: () => {
            const fields: utils.Input[] = [
              new utils.Input({
                name: EdgeCreationInputAction.REFERENCE,
                description: `Reference ${edge.head.indefinite} to a new "${edge.tail}" through the "${edge}" edge, used internally when we know that the reference exists.`,
                type: edge.head.uniqueFilterInputType,
                nullable: false,
                public: false,
              }),
              new utils.Input({
                name: EdgeCreationInputAction.CONNECT,
                description: `Connect ${edge.head.indefinite} to a new "${edge.tail}" through the "${edge}" edge, throw an error if it does not exist.`,
                type: edge.head.uniqueFilterInputType,
                nullable: false,
              }),
            ];

            if (edge.isNullable()) {
              fields.push(
                new utils.Input({
                  name: EdgeCreationInputAction.CONNECT_IF_EXISTS,
                  description: `Connect ${edge.head.indefinite} to a new "${edge.tail}" through the "${edge}" edge, if it exists.`,
                  type: edge.head.uniqueFilterInputType,
                  nullable: false,
                }),
              );
            }

            if (edge.head.isCreatable()) {
              fields.push(
                new utils.Input({
                  name: EdgeCreationInputAction.CREATE,
                  description: `Create ${edge.head.indefinite} and connect it to a new "${edge.tail}" through the "${edge}" edge.`,
                  type: edge.head.creationInputType,
                  nullable: false,
                }),
                new utils.Input({
                  name: EdgeCreationInputAction.CREATE_IF_NOT_EXISTS,
                  description: `Create ${edge.head.indefinite} if it does not exist, and connect it to a new "${edge.tail}" through the "${edge}" edge.`,
                  type: new utils.ObjectInputType({
                    name: [
                      edge.tail.name,
                      inflection.camelize(utils.MutationType.CREATION),
                      edge.pascalCasedName,
                      inflection.camelize(
                        EdgeCreationInputAction.CREATE_IF_NOT_EXISTS,
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

  /**
   * Resolve the nested-actions into a value
   */
  public async resolveValue(
    inputValue: NonNullable<EdgeCreationInputValue>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<EdgeCreationValue> {
    const headAPI = this.edge.head.createContextBoundAPI(context);

    const selection = this.edge.referencedUniqueConstraint.selection;

    const actionName = (
      Object.keys(inputValue) as EdgeCreationInputAction[]
    ).at(0);

    if (actionName) {
      const actionPath = utils.addPath(path, actionName);

      switch (actionName) {
        case EdgeCreationInputAction.REFERENCE:
          return selection.parseSource(inputValue[actionName], actionPath);

        case EdgeCreationInputAction.CONNECT: {
          const where = inputValue[actionName]!;

          return headAPI.getOne({ where, selection }, actionPath);
        }

        case EdgeCreationInputAction.CONNECT_IF_EXISTS: {
          const where = inputValue[actionName]!;

          return headAPI.getOneIfExists({ where, selection }, actionPath);
        }

        case EdgeCreationInputAction.CREATE: {
          const data = inputValue[actionName]!;

          return headAPI.createOne({ data, selection }, actionPath);
        }

        case EdgeCreationInputAction.CREATE_IF_NOT_EXISTS: {
          const { where, data } = inputValue[actionName]!;

          return headAPI.createOneIfNotExists(
            { where, data, selection },
            actionPath,
          );
        }

        default:
          throw new utils.UnreachableValueError(actionName, {
            path,
          });
      }
    }
  }
}
