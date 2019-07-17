import { ConnectorCountOperationArgs, ConnectorCountOperationResult } from '@prismamedia/graphql-platform-core';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';

export class CountOperation extends AbstractOperationResolver<
  ConnectorCountOperationArgs,
  ConnectorCountOperationResult
> {
  public async execute({ args, context }: OperationResolverParams<ConnectorCountOperationArgs>) {
    const selectStatement = this.table.newSelectStatement();

    selectStatement.select.add(
      `COUNT(DISTINCT ${this.table
        .getPrimaryKey()
        .getColumnSet()
        .getEscapedNames(selectStatement.from.alias)}) AS result`,
    );

    await this.table.getOperation('Find').parseWhereArg(selectStatement.where, args.where);

    const rows = await this.connector.query(selectStatement.sql, context.connectorRequest.connection);

    if (Array.isArray(rows) && rows.length === 1) {
      const result = parseInt(rows[0].result, 10);
      if (result >= 0) {
        return result;
      }
    }

    throw new Error('An error occurred: the result has to be a positive integer.');
  }
}
