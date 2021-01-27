import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertIterable,
  assertPlainObject,
  assertScalarValue,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { catchRuntimeError } from '../../../../errors';
import { OrderByInputValue } from '../../../types/inputs/order-by';
import { UpdateInputValue } from '../../../types/inputs/update';
import { WhereInputValue } from '../../../types/inputs/where';
import {
  mergeNodeSelections,
  NodeRecord,
  NodeSelection,
  NodeValue,
} from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';

export type UpdateManyOperationArgs = {
  where?: WhereInputValue;
  orderBy?: OrderByInputValue;
  first: number;
  data: UpdateInputValue;
} & RawNodeSelectionAware;

export type UpdateManyOperationResult = NodeValue[];

export class UpdateManyOperation<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  UpdateManyOperationArgs,
  UpdateManyOperationResult
> {
  protected readonly config = this.model.config.mutations?.update;

  public readonly name = `update${this.model.plural}`;
  public readonly description = `Updates many "${this.model.name}" nodes then returns them`;

  @Memoize()
  public get enabled(): boolean {
    return this.model.getOperation('update').enabled;
  }

  @Memoize()
  public get public(): boolean {
    return this.model.getOperation('update').public;
  }

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: this.model.whereInputType.type,
      },
      ...(this.model.orderByInputType.type && {
        orderBy: {
          type: this.model.orderByInputType.type,
        },
      }),
      first: {
        type: GraphQLNonNull(Scalars.PositiveInt),
      },
      data: {
        type: this.model.updateInputType.type!,
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(
      GraphQLList(GraphQLNonNull(this.model.nodeType.type)),
    );
  }

  protected async doExecute(
    args: SelectionAware<UpdateManyOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<UpdateManyOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');
    const dataPath = addPath(argsPath, 'data');

    // First, we validate the provided "data" argument
    const data = Object.freeze(
      this.model.updateInputType.assertValue(args.data, dataPath),
    );

    // Does any "preCreate" hook depends on the current node's value?
    const currentNodeSelections: NodeSelection[] = (<
      (NodeSelection | undefined)[]
    >[
      this.model.updateInputType.dependsOnCurrentNodeSelection(
        data,
        operationContext,
        path,
      ),
      ...[...this.model.updateInputType.componentFieldMap.values()].map(
        (field) =>
          field.dependsOnCurrentNodeSelection(data, operationContext, path),
      ),
    ]).filter(
      (maybeNodeSelection): maybeNodeSelection is NodeSelection =>
        maybeNodeSelection instanceof NodeSelection,
    );

    let updatedRecords: NodeRecord[];

    // Depending on whether there is a dependency on the current node value or not, the workflow is different:
    if (currentNodeSelections.length > 0) {
      const currentNodeSelection = mergeNodeSelections(
        // We always select the identifier
        this.model.identifierSelection,
        ...currentNodeSelections,
      );

      const currentNodeValues = await this.model.api.find<true>(
        {
          where: args.where,
          orderBy: args.orderBy,
          first: args.first,
          selection: currentNodeSelection,
        },
        operationContext,
        path,
      );

      updatedRecords = [];

      await Promise.all(
        currentNodeValues.map(async (currentNodeValue, index) => {
          const update = await this.model.updateInputType.parseValue(
            currentNodeValue,
            data,
            operationContext,
            dataPath,
          );

          const indexedPath = addPath(path, index);

          updatedRecords.push(
            ...(await catchRuntimeError(
              () =>
                this.connector.update(
                  this.model,
                  {
                    // We don't need to "contextualized" this filter as it's the result of a "contextualized" query
                    filter: this.model.whereInputType.parseValue(
                      this.model.assertIdentifier(
                        currentNodeValue,
                        indexedPath,
                      ),
                      indexedPath,
                    ),
                    first: 1,
                    update,
                  },
                  operationContext,
                ),
              indexedPath,
            )),
          );
        }),
      );
    } else {
      const filter = await this.model.getContextualizedFilter(
        args.where,
        operationContext,
        addPath(argsPath, 'where'),
      );

      // In case of a "false" filter, we can save a connector call
      if (filter.kind === 'Boolean' && !filter.value) {
        return [];
      }

      const update = await this.model.updateInputType.parseValue(
        undefined,
        data,
        operationContext,
        dataPath,
      );

      updatedRecords = await catchRuntimeError(
        () =>
          this.connector.update(
            this.model,
            {
              ...(!(filter.kind === 'Boolean' && filter.value) && {
                filter: filter,
              }),
              ...(args.orderBy && {
                sorts: this.model.orderByInputType.parseValue(
                  args.orderBy,
                  addPath(argsPath, 'orderBy'),
                ),
              }),
              first: assertScalarValue(
                Scalars.PositiveInt,
                args.first,
                addPath(argsPath, 'first'),
              ),
              update,
            },
            operationContext,
          ),
        path,
      );
    }

    assertIterable(updatedRecords, path);

    return Promise.all(
      Array.from(updatedRecords, async (updatedRecord, index) => {
        const indexedPath = addPath(path, index);
        const record = Object.freeze(
          this.model.assertRecord(updatedRecord, indexedPath),
        );

        // // We'll fire this event only if the operation is a success
        // operationContext.postSuccessEvents.push(
        //   this.model.emit.bind(this.model, 'updated', {
        //     model: this.model,
        //     record,
        //   }),
        // );

        await this.model.updateInputType.handleReverseEdges(
          record,
          data,
          operationContext,
          addPath(dataPath, index),
        );

        await this.config?.postUpdate?.(
          Object.freeze({
            record,
            data,
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
          this.model.nodeType.isValue(record, args.selection) &&
          (!this.config?.postUpdate || args.selection.immutable)
        ) {
          return this.model.nodeType.assertValue(
            record,
            indexedPath,
            args.selection,
          );
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
