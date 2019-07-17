import { ConnectorUpdateOperationArgs, ConnectorUpdateOperationResult } from '@prismamedia/graphql-platform-core';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';

export class UpdateOperation extends AbstractOperationResolver<
  ConnectorUpdateOperationArgs,
  ConnectorUpdateOperationResult
> {
  public async execute({
    args: { data: update, where },
    context,
  }: OperationResolverParams<ConnectorUpdateOperationArgs>): Promise<ConnectorUpdateOperationResult> {
    const updateStatement = this.table.newUpdateStatement();

    for (const column of this.table.getColumnSet()) {
      const columnValue = column.getValue(update, false);
      if (typeof columnValue !== 'undefined') {
        updateStatement.assignmentList.addAssignment(column, columnValue);
      }
    }

    await this.table.getOperation('Find').parseWhereArg(updateStatement.where, where);

    const result = await this.connector.query(updateStatement.sql, context.connectorRequest.connection);

    if (
      'affectedRows' in result &&
      typeof result.affectedRows === 'number' &&
      Number.isInteger(result.affectedRows) &&
      result.affectedRows >= 0 &&
      'changedRows' in result &&
      typeof result.changedRows === 'number' &&
      Number.isInteger(result.changedRows) &&
      result.changedRows >= 0
    ) {
      return {
        matchedCount: result.affectedRows,
        changedCount: result.changedRows,
      };
    }

    throw new Error('An error occurred: the result has to be a positive integer.');
  }
}
