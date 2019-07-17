import { ConnectorDeleteOperationArgs, ConnectorDeleteOperationResult } from '@prismamedia/graphql-platform-core';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';

export class DeleteOperation extends AbstractOperationResolver<
  ConnectorDeleteOperationArgs,
  ConnectorDeleteOperationResult
> {
  public async execute({ args, context }: OperationResolverParams<ConnectorDeleteOperationArgs>) {
    const deleteStatement = this.table.newDeleteStatement();

    await this.table.getOperation('Find').parseWhereArg(deleteStatement.where, args.where);

    const result = await this.connector.query(deleteStatement.sql, context.connectorRequest.connection);

    if (
      'affectedRows' in result &&
      typeof result.affectedRows === 'number' &&
      Number.isInteger(result.affectedRows) &&
      result.affectedRows >= 0
    ) {
      return result.affectedRows;
    }

    throw new Error('An error occurred: the result has to be a positive integer.');
  }
}
