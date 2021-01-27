import {
  addPath,
  indefinite,
  isPlainObject,
  Path,
  UnexpectedValueError,
  UnreachableValueError,
} from '@prismamedia/graphql-platform-utils';
import {
  GraphQLBoolean,
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
import { CommonUpdateOperationHookArgs } from '../../../../../operations/mutations/update/config';
import {
  ComponentNames,
  Fragment,
  NodeSelection,
  NodeValue,
} from '../../../../node';
import { CreationInputValue } from '../../../creation';
import { PendingNodeUpdate, UpdateInputValue } from '../../../update';
import { WhereUniqueInputValue } from '../../../where-unique';
import {
  AbstractComponentInputField,
  AbstractComponentInputFieldConfig,
  AbstractComponentPreUpdateHookArgs,
} from './abstract';

export type EdgeInputFieldValue = RequireExactlyOne<{
  connect: WhereUniqueInputValue;
  connectIfExists: WhereUniqueInputValue;
  create: CreationInputValue;
}> | null;

export type EdgeUpdate = ReferenceValue;

type UpdateInputEdgeAction = keyof NonNullable<EdgeInputFieldValue>;

const updateInputEdgeActions = Object.freeze(<UpdateInputEdgeAction[]>[
  'connect',
  'connectIfExists',
  'create',
]);

interface DependsOnCurrentNodeValueArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends Omit<
    CommonUpdateOperationHookArgs<TRequestContext, TConnector>,
    'api'
  > {
  /**
   * The "edge"'s update provided by the client
   */
  edgeUpdate: EdgeUpdate | undefined;

  /**
   * The "edge"'s definition
   */
  edge: Reference<TRequestContext, TConnector>;
}

interface PreUpdateHookArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractComponentPreUpdateHookArgs<TRequestContext, TConnector> {
  /**
   * The "edge"'s update provided by the client
   */
  edgeUpdate: EdgeUpdate | undefined;

  /**
   * The "edge"'s definition
   */
  edge: Reference<TRequestContext, TConnector>;
}

export type EdgeInputFieldConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Except<
  AbstractComponentInputFieldConfig<EdgeInputFieldValue>,
  'type' | 'assertValue' | 'nullable'
> & {
  /**
   * Optional, the "edge"'s "preUpdate" hook can depend on the current node's value
   *
   * expects a "fragment" as a string or an iterable of component names
   */
  dependsOnCurrentNodeValue?:
    | ((
        args: {
          /**
           * The "edge"'s update provided by the client
           */
          edgeUpdate: EdgeUpdate | undefined;

          /**
           * The "edge"'s definition
           */
          edge: Reference<TRequestContext, TConnector>;
        } & DependsOnCurrentNodeValueArgs<TRequestContext, TConnector>,
      ) => Fragment | ComponentNames | undefined)
    | (Fragment | ComponentNames | undefined);

  /**
   * Optional, you can control how the value is validate/generated with a custom "parser"
   *
   * This parser has to return a valid reference value
   */
  preUpdate?(
    args: {
      /**
       * The "edge"'s update provided by the client
       */
      edgeUpdate: EdgeUpdate | undefined;

      /**
       * The "edge"'s definition
       */
      edge: Reference<TRequestContext, TConnector>;
    } & AbstractComponentPreUpdateHookArgs<TRequestContext, TConnector>,
  ): Promisable<EdgeUpdate | undefined>;
};

export class EdgeInputField extends AbstractComponentInputField<
  EdgeInputFieldValue | undefined,
  EdgeUpdate | undefined
> {
  readonly #dependsOnCurrent: EdgeInputFieldConfig['dependsOnCurrentNodeValue'];
  readonly #parser: EdgeInputFieldConfig['preUpdate'];

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
            'Update',
            camelize(edge.name, false),
            'EdgeInput',
          ].join(''),
          fields: () => {
            const actions: Partial<
              Record<UpdateInputEdgeAction, GraphQLInputFieldConfig>
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
                type: edge.head.creationInputType.type ?? GraphQLBoolean,
              };
            }

            return actions as GraphQLInputFieldConfigMap;
          },
        }),

      assertValue(value, path) {
        if (
          !isPlainObject(value) ||
          Object.keys(value).length !== 1 ||
          !updateInputEdgeActions.includes(Object.keys(value)[0] as any)
        ) {
          throw new UnexpectedValueError(
            value,
            `an object containing exactly one action among "${updateInputEdgeActions.join(
              ', ',
            )}"`,
            path,
          );
        }

        const action = Object.keys(value)[0] as UpdateInputEdgeAction;

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
      ...omit(config, ['dependsOnCurrentNodeValue', 'preUpdate']),
    });

    this.#dependsOnCurrent = config?.dependsOnCurrentNodeValue;
    this.#parser = config?.preUpdate;
  }

  public dependsOnCurrentNodeSelection(
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): NodeSelection | undefined {
    const rawNodeSelection =
      typeof this.#dependsOnCurrent === 'function'
        ? this.#dependsOnCurrent({
            edgeUpdate: Object.freeze(data[this.name]),
            data,
            edge: this.edge,
            path,
            operationContext,
          })
        : this.#dependsOnCurrent;

    return rawNodeSelection
      ? this.edge.model.nodeType.select(rawNodeSelection, path)
      : undefined;
  }

  protected async resolveValue(
    inputValue: NonNullable<EdgeInputFieldValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<ReferenceValue> {
    const action = Object.keys(inputValue)[0] as UpdateInputEdgeAction;
    switch (action) {
      case 'connect':
        return this.edge.head.api.get(
          {
            where: inputValue[action]!,
            selection: this.edge.headReference.selection,
          },
          operationContext,
          addPath(path, action),
        );

      case 'connectIfExists':
        return this.edge.head.api.getIfExists(
          {
            where: inputValue[action]!,
            selection: this.edge.headReference.selection,
          },
          operationContext,
          addPath(path, action),
        );

      case 'create':
        return this.edge.head.api.create(
          {
            data: inputValue[action]!,
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
    currentNodeValue: Readonly<NodeValue> | undefined,
    pendingUpdate: Readonly<PendingNodeUpdate>,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<EdgeUpdate | undefined> {
    const resolvedInput =
      inputValue != null
        ? await this.resolveValue(inputValue, operationContext, path)
        : inputValue;

    const parsedUpdate = this.#parser
      ? await this.#parser({
          edgeUpdate: Object.freeze(resolvedInput),
          edge: this.edge,
          update: await this.getPartialUpdate(pendingUpdate),
          currentNodeValue: this.getCurrentNodeValue(
            currentNodeValue,
            data,
            operationContext,
            path,
          ),
          data,
          api: operationContext.createBoundAPI(path),
          path,
          operationContext,
        })
      : resolvedInput;

    return parsedUpdate !== undefined
      ? this.edge.assertValue(parsedUpdate, path)
      : undefined;
  }
}
