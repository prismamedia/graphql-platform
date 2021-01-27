import { assertPlainObject, Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { CreationInputValue } from '../../../types/inputs/creation';
import { NodeValue } from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';

export type CreateOneOperationArgs = {
  data?: CreationInputValue;
} & RawNodeSelectionAware;

export type CreateOneOperationResult = NodeValue;

export class CreateOneOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  CreateOneOperationArgs,
  CreateOneOperationResult
> {
  protected readonly config = this.model.config.mutations?.create;

  public readonly name = `create${this.model.name}`;
  public readonly description = `Creates one "${this.model.name}" node then returns it`;

  @Memoize()
  public get public(): boolean {
    return (
      super.public &&
      [...this.model.creationInputType.requiredFieldMap.values()].every(
        (field) => field.public,
      )
    );
  }

  public get graphqlFieldConfigArgs() {
    return this.model.creationInputType.type
      ? {
          data: {
            type: this.model.creationInputType.type,
          },
        }
      : {};
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(this.model.nodeType.type);
  }

  protected async doExecute(
    args: SelectionAware<CreateOneOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<CreateOneOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const [nodeValue] = await this.model.api.createMany<true>(
      {
        data: [args.data],
        selection: args.selection,
      },
      operationContext,
      path,
    );

    return nodeValue;
  }
}
