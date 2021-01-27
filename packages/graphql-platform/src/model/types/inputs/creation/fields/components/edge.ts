import {
  addPath,
  indefinite,
  isPlainObject,
  Path,
  UnexpectedValueError,
  UnreachableValueError,
} from '@prismamedia/graphql-platform-utils';
import {
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
} from 'graphql';
import { camelize } from 'inflection';
import { omit } from 'lodash';
import { Except, Promisable, RequireExactlyOne } from 'type-fest';
import { ConnectorInterface } from '../../../../../../connector';
import { Reference, ReferenceValue } from '../../../../../components';
import { OperationContext } from '../../../../../operations/context';
import { CreationInputValue, PendingNodeCreation } from '../../../creation';
import { WhereUniqueInputValue } from '../../../where-unique';
import {
  AbstractComponentInputField,
  AbstractComponentInputFieldConfig,
  AbstractComponentPreCreateArgs,
} from './abstract';

export type EdgeInputFieldValue = RequireExactlyOne<{
  connect: WhereUniqueInputValue;
  connectIfExists: WhereUniqueInputValue;
  create: CreationInputValue;
}> | null;

type EdgeInputActionName = keyof NonNullable<EdgeInputFieldValue>;

const edgeInputActionNames = Object.freeze(<EdgeInputActionName[]>[
  'connect',
  'connectIfExists',
  'create',
]);

export type EdgeInputFieldConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Except<
  AbstractComponentInputFieldConfig<EdgeInputFieldValue>,
  'type' | 'assertValue' | 'nullable'
> & {
  /**
   * Optional, add some custom logic over the "edge" value about to be sent to the connector
   */
  preCreate?(
    args: {
      /**
       * The "edge"'s value provided by the client
       */
      edgeValue: ReferenceValue | undefined;

      /**
       * The "edge"'s definition
       */
      edge: Reference<TRequestContext, TConnector>;
    } & AbstractComponentPreCreateArgs<TRequestContext, TConnector>,
  ): Promisable<ReferenceValue>;
};

export class EdgeInputField extends AbstractComponentInputField<
  EdgeInputFieldValue | undefined,
  ReferenceValue
> {
  readonly #parser: EdgeInputFieldConfig['preCreate'];

  public constructor(
    public readonly edge: Reference,
    config?: EdgeInputFieldConfig,
  ) {
    super(edge, {
      // defaults
      type: () =>
        new GraphQLInputObjectType({
          name: [
            edge.tail.name,
            'Create',
            camelize(edge.name, false),
            'EdgeInput',
          ].join(''),
          fields: () => {
            const actions: Partial<
              Record<EdgeInputActionName, GraphQLInputFieldConfig>
            > = {
              connect: {
                description: `Connect an existing "${edge.head.name}", throw an error if it does not exist`,
                type: edge.head.whereUniqueInputType.type,
              },
            };

            if (edge.nullable) {
              actions['connectIfExists'] = {
                description: `Connect ${indefinite(edge.head.name, {
                  quote: true,
                })}, if it exists`,
                type: edge.head.whereUniqueInputType.type,
              };
            }

            if (edge.head.getOperation('create').public) {
              actions['create'] = {
                description: `Create and connect a new "${edge.head.name}"`,
                type: edge.head.creationInputType.type,
              };
            }

            return actions as GraphQLInputFieldConfigMap;
          },
        }),

      assertValue(value, path) {
        if (
          !isPlainObject(value) ||
          Object.keys(value).length !== 1 ||
          !edgeInputActionNames.includes(Object.keys(value)[0] as any)
        ) {
          throw new UnexpectedValueError(
            value,
            `an object containing exactly one action among "${edgeInputActionNames.join(
              ', ',
            )}"`,
            path,
          );
        }

        const action = Object.keys(value)[0] as EdgeInputActionName;

        switch (action) {
          case 'connect':
            return {
              [action]: edge.head.whereUniqueInputType.assertValue(
                value[action],
                addPath(path, action),
              ),
            };

          case 'connectIfExists':
            if (!edge.nullable) {
              throw new UnexpectedValueError(
                value,
                `the action "${action}" not to be used as the "${edge.name}" edge is not "nullable"`,
                path,
              );
            }

            return {
              [action]: edge.head.whereUniqueInputType.assertValue(
                value[action],
                addPath(path, action),
              ),
            };

          case 'create':
            const create = edge.head.getOperation('create');

            if (!create.enabled) {
              throw new UnexpectedValueError(
                value,
                `the action "${action}" not to be used as the "${create.name}" operation is disabled`,
                path,
              );
            }

            return {
              [action]: edge.head.creationInputType.assertValue(
                value[action],
                addPath(path, action),
              ),
            };

          default:
            throw new UnreachableValueError(action, `a supported action`, path);
        }
      },

      // config
      ...omit(config, ['preCreate']),
    });

    this.#parser = config?.preCreate;
  }

  protected async resolveValue(
    value: NonNullable<EdgeInputFieldValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<ReferenceValue> {
    const action = Object.keys(value)[0] as EdgeInputActionName;
    switch (action) {
      case 'connect':
        return this.edge.head.api.get(
          {
            where: value[action]!,
            selection: this.edge.headReference.selection,
          },
          operationContext,
          addPath(path, action),
        );

      case 'connectIfExists':
        return this.edge.head.api.getIfExists(
          {
            where: value[action]!,
            selection: this.edge.headReference.selection,
          },
          operationContext,
          addPath(path, action),
        );

      case 'create':
        return this.edge.head.api.create(
          {
            data: value[action]!,
            selection: this.edge.headReference.selection,
          },
          operationContext,
          addPath(path, action),
        );

      default:
        throw new UnreachableValueError(action, `a supported action`, path);
    }
  }

  public async parseValue(
    inputValue: EdgeInputFieldValue | undefined,
    pendingCreation: Readonly<PendingNodeCreation>,
    data: Readonly<CreationInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<ReferenceValue> {
    const resolvedValue =
      inputValue != null
        ? await this.resolveValue(inputValue, operationContext, path)
        : inputValue;

    const parsedValue = this.#parser
      ? await this.#parser({
          edgeValue: Object.freeze(resolvedValue),
          edge: this.edge,
          creation: await this.getPartialCreation(pendingCreation),
          data,
          api: operationContext.createBoundAPI(path),
          path,
          operationContext,
        })
      : resolvedValue;

    return this.edge.assertValue(
      parsedValue === undefined ? null : parsedValue,
      path,
    );
  }
}
