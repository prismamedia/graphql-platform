import { KeysOfUnion } from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
} from 'graphql';
import { camelize } from 'inflection';
import {} from 'type-fest';
import {
  Edge,
  TReferenceValue,
  TWhereUniqueInputValue,
} from '../../../../node';
import { CreateOperation, TCreateDataInputValue } from '../../create';
import { AbstractCreateInputField, ICreateInputFieldConfig } from './abstract';

export type TCreateEdgeInputFieldValue =
  | {
      connect: TWhereUniqueInputValue;
    }
  | {
      connectIfExists: TWhereUniqueInputValue;
    }
  | {
      create: TCreateDataInputValue;
    };

export type TCreateEdgeInputFieldAction = KeysOfUnion<TCreateEdgeInputFieldValue>;

export const createEdgeInputFieldActions = Object.freeze(<
  TCreateEdgeInputFieldAction[]
>['connect', 'connectIfExists', 'create']);

export const isCreateEdgeInputFieldAction = (
  maybeAction: any,
): maybeAction is TCreateEdgeInputFieldAction =>
  createEdgeInputFieldActions.includes(maybeAction);

export interface ICreateEdgeInputFieldConfig
  extends Partial<
    ICreateInputFieldConfig<
      TCreateEdgeInputFieldValue,
      TReferenceValue,
      TReferenceValue
    >
  > {}

export class CreateEdgeInputField extends AbstractCreateInputField<
  TCreateEdgeInputFieldValue,
  TReferenceValue,
  TReferenceValue
> {
  public constructor(operation: CreateOperation, public readonly edge: Edge) {
    super(operation, edge.name, {
      // Defaults
      description: edge.description,
      nullable: edge.nullable,
      public: edge.public,
      type: () =>
        new GraphQLInputObjectType({
          name: [
            operation.node.name,
            camelize(edge.name, false),
            'EdgeCreateInput',
          ].join(''),
          description: `The "${edge.id}" edge's nested mutations`,
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {
              connect: {
                description: `Connect the new "${operation.node.name}" to an existing "${edge.to.name}" through "${edge.id}"`,
                type: edge.to.whereUniqueInput.type,
              },
            };

            if (edge.nullable) {
              fields['connectIfExists'] = {
                description: `Connect the new "${operation.node.name}" to an existing "${edge.to.name}", if exists, through "${edge.id}"`,
                type: edge.to.whereUniqueInput.type,
              };
            }

            const create = edge.to.getOperation('create');
            if (create.public) {
              fields['create'] = {
                description: `Connect the new "${operation.node.name}" to a new "${edge.to.name}" through "${edge.id}"`,
                type: create.dataType || GraphQLBoolean,
              };
            }

            return fields;
          },
        }),
      // parser: async () => undefined,

      // Custom config
      ...edge.config?.inputs?.create,
      // parser: async ({ operationContext, path, value }) => {
      //   const [action, ...rest] = isPlainObject(value)
      //     ? Object.keys(value)
      //     : [];

      //   if (!isCreateEdgeInputFieldAction(action) || rest.length) {
      //     throw new UnexpectedValueError(
      //       path,
      //       value,
      //       `an object containing exactly one action among "${[
      //         ...createEdgeInputFieldActions,
      //       ].join(', ')}"`,
      //     );
      //   }

      //   const actionValue = (value as any)[action];

      //   switch (action) {
      //     case 'connect':
      //       return edge.to.getOperation('get').execute(
      //         {
      //           where: actionValue,
      //           selections: edge.selection.selections,
      //         },
      //         operationContext,
      //         addPath(path, action),
      //       );

      //     case 'connectIfExists':
      //       if (!edge.nullable) {
      //         throw new UnexpectedValueError(
      //           path,
      //           value,
      //           `not to use the action "${action}"`,
      //         );
      //       }

      //       return edge.to.getOperation('getIfExists').execute(
      //         {
      //           where: actionValue,
      //           selections: edge.selection.selections,
      //         },
      //         operationContext,
      //         addPath(path, action),
      //       );

      //     case 'create':
      //       return edge.to.getOperation('create').execute(
      //         {
      //           data: actionValue,
      //           selections: edge.selection.selections,
      //         },
      //         operationContext,
      //         addPath(path, action),
      //       );

      //     default:
      //       throw new UnexpectedValueError(
      //         path,
      //         action,
      //         `an action among "${createEdgeInputFieldActions.join(', ')}"`,
      //       );
      //   }
      // },
    });
  }
}
