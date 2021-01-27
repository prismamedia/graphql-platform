import {
  addPath,
  assertIterable,
  assertPlainObject,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLBoolean, GraphQLList, GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { catchRuntimeError } from '../../../../errors';
import { CreationInputValue } from '../../../types/inputs/creation';
import { NodeValue } from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';

export type CreateManyOperationArgs = {
  data: Iterable<CreationInputValue>;
} & RawNodeSelectionAware;

export type CreateManyOperationResult = NodeValue[];

export class CreateManyOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  CreateManyOperationArgs,
  CreateManyOperationResult
> {
  protected readonly config = this.model.config.mutations?.create;

  public readonly name = `create${this.model.plural}`;
  public readonly description = `Creates many "${this.model.name}" nodes then returns them`;

  @Memoize()
  public get enabled(): boolean {
    return this.model.getOperation('create').enabled;
  }

  @Memoize()
  public get public(): boolean {
    return this.model.getOperation('create').public;
  }

  public get graphqlFieldConfigArgs() {
    return {
      data: {
        type: GraphQLNonNull(
          GraphQLList(this.model.creationInputType.type ?? GraphQLBoolean),
        ),
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(GraphQLList(GraphQLNonNull(this.model.nodeType.type)));
  }

  protected async doExecute(
    args: SelectionAware<CreateManyOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<CreateManyOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');
    const dataPath = addPath(argsPath, 'data');

    // First, we validate the provided "data" argument
    assertIterable(args.data, dataPath);
    const data = Array.from(args.data, (datum, index) =>
      Object.freeze(
        this.model.creationInputType.assertValue(datum, addPath(dataPath, index)),
      ),
    );

    if (data.length === 0) {
      return [];
    }

    // Then we build the "creations"
    const creations = await Promise.all(
      data.map((datum, index) =>
        this.model.creationInputType.parseValue(
          datum,
          operationContext,
          addPath(dataPath, index),
        ),
      ),
    );

    // We actually send the "creations" to the connector here
    const createdRecords = await catchRuntimeError(
      () => this.connector.create(this.model, { creations }, operationContext),
      path,
    );

    assertIterable(createdRecords, path);

    return Promise.all(
      Array.from(createdRecords, async (createdRecord, index) => {
        const indexedPath = addPath(path, index);
        const record = Object.freeze(
          this.model.assertRecord(createdRecord, indexedPath),
        );
        const datum = data[index];

        // // We'll fire this event only if the operation is a success
        // operationContext.postSuccessEvents.push(
        //   this.model.emit.bind(this.model, 'created', {
        //     model: this.model,
        //     record,
        //   }),
        // );

        await this.model.creationInputType.handleReverseEdges(
          record,
          datum,
          operationContext,
          addPath(dataPath, index),
        );

        await this.config?.postCreate?.(
          Object.freeze({
            record,
            data: datum,
            model: this.model,
            api: operationContext.createBoundAPI(indexedPath),
            path: indexedPath,
            operationContext,
          }),
        );

        /**
         * If the selection is contained in the record, we can return the result immediately if one of these condition is satisfied:
         *  - there is no "preSuccess" hook that could change the record
         *  - the selection is immutable
         */
        if (
          args.selection.isValue(record) &&
          (!this.config?.postCreate || args.selection.immutable)
        ) {
          return args.selection.assertValue(record, indexedPath);
        }

        return this.model.api.get<true>(
          {
            where: this.model.assertIdentifier(record, indexedPath),
            selection: args.selection,
          },
          operationContext,
          indexedPath,
        );
      }),
    );
  }
}
