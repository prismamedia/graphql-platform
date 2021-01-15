import {
  ArrayOrValue,
  GraphQLListDecorator,
  KeysOfUnion,
} from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
} from 'graphql';
import { camelize } from 'inflection';
import { ReverseEdge } from '../../../../node';
import { TWhereUniqueInputValue } from '../../../../node/where-unique-input';
import { CreateOperation, TCreateDataInputValue } from '../../create';
import { AbstractCreateInputField, ICreateInputFieldConfig } from './abstract';

export type TCreateReverseEdgeInputFieldValue =
  | {
      connect: ArrayOrValue<TWhereUniqueInputValue>;
    }
  | {
      connectIfExists: ArrayOrValue<TWhereUniqueInputValue>;
    }
  | {
      create: ArrayOrValue<TCreateDataInputValue>;
    };

export type TCreateReverseEdgeInputFieldAction = KeysOfUnion<TCreateReverseEdgeInputFieldValue>;

export const createReverseEdgeInputFieldActions = Object.freeze(<
  TCreateReverseEdgeInputFieldAction[]
>['connect', 'connectIfExists', 'create']);

export const isCreateReverseEdgeInputFieldAction = (
  maybeAction: any,
): maybeAction is TCreateReverseEdgeInputFieldAction =>
  createReverseEdgeInputFieldActions.includes(maybeAction);

export interface ICreateReverseEdgeInputFieldConfig
  extends Omit<
    ICreateInputFieldConfig<TCreateReverseEdgeInputFieldValue, void, void>,
    'public' | 'nullable' | 'type' | 'parser'
  > {}

export class CreateReverseEdgeInputField extends AbstractCreateInputField<
  TCreateReverseEdgeInputFieldValue,
  void
> {
  public constructor(
    operation: CreateOperation,
    public readonly reverseEdge: ReverseEdge,
  ) {
    super(operation, reverseEdge.name, {
      // Defaults
      description: reverseEdge.description,
      nullable: true,
      public: () =>
        reverseEdge.public &&
        ((!reverseEdge.edge.immutable &&
          (reverseEdge.to.getOperation('update').public ||
            reverseEdge.to.getOperation('updateIfExists').public)) ||
          reverseEdge.to.getOperation('create').public),
      type: () =>
        new GraphQLInputObjectType({
          name: [
            operation.node.name,
            camelize(reverseEdge.name, false),
            'ReverseEdgeCreateInput',
          ].join(''),
          description: `The "${reverseEdge.id}" reverse edge's nested mutations`,
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            if (!reverseEdge.edge.immutable) {
              const update = reverseEdge.to.getOperation('update');
              if (update.public) {
                fields['connect'] = {
                  description: `Connect the new "${operation.node.name}" to an existing "${reverseEdge.to.name}" through "${reverseEdge.id}"`,
                  type: GraphQLListDecorator(
                    reverseEdge.to.whereUniqueInput.type,
                    !reverseEdge.unique,
                  ),
                };
              }

              const updateIfExists = reverseEdge.to.getOperation(
                'updateIfExists',
              );
              if (updateIfExists.public) {
                fields['connectIfExists'] = {
                  description: `Connect the new "${operation.node.name}" to an existing "${reverseEdge.to.name}", if exists, through "${reverseEdge.id}"`,
                  type: GraphQLListDecorator(
                    reverseEdge.to.whereUniqueInput.type,
                    !reverseEdge.unique,
                  ),
                };
              }
            }

            const create = reverseEdge.to.getOperation('create');
            if (create.public) {
              fields['create'] = {
                description: `Connect the new "${operation.node.name}" to a new "${reverseEdge.to.name}" through "${reverseEdge.id}"`,
                type: GraphQLListDecorator(
                  create.getDataWithoutEdgeType(reverseEdge.edge) ||
                    GraphQLBoolean,
                  !reverseEdge.unique,
                ),
              };
            }

            return fields;
          },
        }),

      // Custom config
      ...reverseEdge.config?.inputs?.create,
    });
  }
}
