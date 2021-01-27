import { assertPlainObject, Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../connector';
import { CreationInputValue } from '../../types/inputs/creation';
import { UpdateInputValue } from '../../types/inputs/update';
import { WhereUniqueInputValue } from '../../types/inputs/where-unique';
import { NodeValue } from '../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../abstract';
import { OperationContext } from '../context';
import { AbstractMutation } from './abstract';

export type UpsertOneOperationArgs = {
  where: WhereUniqueInputValue;
  create?: CreationInputValue;
  update?: UpdateInputValue;
} & RawNodeSelectionAware;

export type UpsertOneOperationResult = NodeValue;

export class UpsertOneOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  UpsertOneOperationArgs,
  UpsertOneOperationResult
> {
  public readonly name = `upsert${this.model.name}`;
  public readonly description = `UP(date|ins)SERT, updates or inserts, one "${this.model.name}" node then returns it`;

  @Memoize()
  public get enabled(): boolean {
    return (
      this.model.getOperation('create').enabled &&
      this.model.getOperation('update').enabled
    );
  }

  @Memoize()
  public get public(): boolean {
    return (
      this.model.getOperation('create').public &&
      this.model.getOperation('update').public
    );
  }

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: GraphQLNonNull(this.model.whereUniqueInputType.type),
      },
      create: {
        type: this.model.creationInputType.type!,
      },
      update: {
        type: this.model.updateInputType.type!,
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(this.model.nodeType.type);
  }

  protected async doExecute(
    args: SelectionAware<UpsertOneOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<UpsertOneOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    // Even if we have selected some extra fields for the listeners, we return only what the client selected
    return this.model.nodeType.assertValue({}, path, args.selection);
  }
}
