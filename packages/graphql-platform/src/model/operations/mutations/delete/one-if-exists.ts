import {
  addPath,
  assertPlainObject,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { NodeValue } from '../../../types/node';
import { SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';
import { DeleteOneOperationArgs } from './one';

export type DeleteOneIfExistsOperationArgs = DeleteOneOperationArgs;

export type DeleteOneIfExistsOperationResult = NodeValue | null;

export class DeleteOneIfExistsOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  DeleteOneIfExistsOperationArgs,
  DeleteOneIfExistsOperationResult
> {
  protected readonly config = this.model.config.mutations?.delete;

  public readonly name = `delete${this.model.name}IfExists`;
  public readonly description = `Deletes one "${this.model.name}" node then returns it or null if it does not exist`;

  public get enabled() {
    return this.model.getOperation('delete').enabled;
  }

  public get public() {
    return this.model.getOperation('delete').public;
  }

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: GraphQLNonNull(this.model.whereUniqueInputType.type),
      },
    };
  }

  public get graphqlFieldConfigType() {
    return this.model.nodeType.type;
  }

  protected async doExecute(
    args: SelectionAware<DeleteOneIfExistsOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<DeleteOneIfExistsOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');

    const filter = await this.model.getContextualizedFilter(
      this.model.whereUniqueInputType.assertValue(
        args.where,
        addPath(argsPath, 'where'),
      ),
      operationContext,
      path,
    );

    const [nodeValue = null] =
      filter.kind === 'Boolean' && !filter.value
        ? // In case of a "false" filter, we can save a connector call
          []
        : await this.connector.delete(
            this.model,
            {
              filter,
              first: 1,
            },
            operationContext,
          );

    if (nodeValue) {
      // operationContext.postSuccessEvents.push(
      //   this.model.emit.bind(this.model, 'deleted', {
      //     model: this.model,
      //     record: this.model.assertRecord(nodeValue, path),
      //   }),
      // );

      return this.model.nodeType.assertValue(nodeValue, path, args.selection);
    }

    return null;
  }
}
