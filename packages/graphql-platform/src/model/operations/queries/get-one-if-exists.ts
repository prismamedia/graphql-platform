import {
  addPath,
  assertPlainObject,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { ConnectorInterface } from '../../../connector';
import { OperationContext } from '../../operations';
import { NodeValue } from '../../types/node';
import { SelectionAware } from '../abstract';
import { AbstractQuery } from './abstract';
import { GetOneOperationArgs } from './get-one';

export type GetOneIfExistsOperationArgs = GetOneOperationArgs;

export type GetOneIfExistsOperationResult = NodeValue | null;

export class GetOneIfExistsOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  GetOneIfExistsOperationArgs,
  GetOneIfExistsOperationResult
> {
  public readonly name = `${camelize(this.model.name, true)}IfExists`;
  public readonly description = `Retrieves one "${this.model.name}" node, returns null if it does not exist`;

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
    args: SelectionAware<GetOneIfExistsOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<GetOneIfExistsOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');

    const [nodeValue = null] = await this.model.api.find<true>(
      {
        where: this.model.whereUniqueInputType.assertValue(
          args.where,
          addPath(argsPath, 'where'),
        ),
        first: 1,
        selection: args.selection,
      },
      operationContext,
      path,
    );

    return nodeValue;
  }
}
