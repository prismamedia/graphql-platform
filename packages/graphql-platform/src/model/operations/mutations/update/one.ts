import { Path, PlainObject } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { WhereUniqueInputValue } from '../../../types/inputs/where-unique';
import { NodeValue } from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { NodeNotFoundError } from '../../errors';
import { AbstractMutation } from '../abstract';

export type UpdateOneInputValue = PlainObject;

export type UpdateOneOperationArgs = {
  where: WhereUniqueInputValue;
  data: UpdateOneInputValue;
} & RawNodeSelectionAware;

export type UpdateOneOperationResult = NodeValue;

export class UpdateOneOperation<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  UpdateOneOperationArgs,
  UpdateOneOperationResult
> {
  public readonly name = `update${this.model.name}`;
  public readonly description = `Updates one "${this.model.name}" node then returns it or throws an error if it does not exist`;

  @Memoize()
  public get enabled(): boolean {
    return super.enabled && this.model.updateInputType.componentFieldMap.size > 0;
  }

  @Memoize()
  public get public(): boolean {
    return (
      super.public && this.model.updateInputType.publicComponentFieldMap.size > 0
    );
  }

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: GraphQLNonNull(this.model.whereUniqueInputType.type),
      },
      data: {
        type: this.model.updateInputType.type!,
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(this.model.nodeType.type);
  }

  protected async doExecute(
    args: SelectionAware<UpdateOneOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<UpdateOneOperationResult> {
    const nodeValue = await this.model.api.updateIfExists<true>(
      args,
      operationContext,
      path,
    );

    if (!nodeValue) {
      throw new NodeNotFoundError(this.model, args.where, path);
    }

    return nodeValue;
  }
}
