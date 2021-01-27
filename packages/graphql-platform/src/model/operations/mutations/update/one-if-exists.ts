import { Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { ConnectorInterface } from '../../../../connector';
import { NodeValue } from '../../../types/node';
import { SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';
import { UpdateOneOperationArgs } from './one';

export type UpdateOneIfExistsOperationArgs = UpdateOneOperationArgs;

export type UpdateOneIfExistsOperationResult = NodeValue | null;

export class UpdateOneIfExistsOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  UpdateOneIfExistsOperationArgs,
  UpdateOneIfExistsOperationResult
> {
  protected readonly config = this.model.config.mutations?.update;

  public readonly name = `update${this.model.name}IfExists`;
  public readonly description = `Updates one "${this.model.name}" node then returns it or null if it does not exist`;

  @Memoize()
  public get enabled(): boolean {
    return this.model.getOperation('update').enabled;
  }

  @Memoize()
  public get public(): boolean {
    return this.model.getOperation('update').public;
  }

  @Memoize()
  public get graphqlFieldConfigArgs() {
    return this.model.getOperation('update').graphqlFieldConfigArgs;
  }

  public get graphqlFieldConfigType() {
    return this.model.nodeType.type;
  }

  protected async doExecute(
    args: SelectionAware<UpdateOneIfExistsOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<UpdateOneIfExistsOperationResult> {
    const [nodeValue = null] = await this.model.api.updateMany<true>(
      {
        ...args,
        where: this.model.whereUniqueInputType.assertValue(args.where, path),
        first: 1,
      },
      operationContext,
      path,
    );

    return nodeValue;
  }
}
