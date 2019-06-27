import { ConnectorCreateOperationArgs, ConnectorCreateOperationResult } from '@prismamedia/graphql-platform-core';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';

export class CreateOperation extends AbstractOperationResolver<
  ConnectorCreateOperationArgs,
  ConnectorCreateOperationResult
> {
  public async execute({
    args: { data: creates },
    connection,
  }: OperationResolverParams<ConnectorCreateOperationArgs>): Promise<ConnectorCreateOperationResult> {
    return Promise.all(
      creates.map(async create => {
        const insertStatement = this.table.newInsertStatement();

        for (const column of this.table.getColumnSet()) {
          const columnValue = column.getValue(create);
          if (typeof columnValue !== 'undefined') {
            insertStatement.assignmentList.addAssignment(column, columnValue);
          }
        }

        const result = await this.connector.query(insertStatement.sql, connection);

        const autoIncrementColumn = this.table.getAutoIncrementColumn();
        if (autoIncrementColumn) {
          if (!('insertId' in result && typeof result.insertId === 'number')) {
            throw new Error(
              `As the column "${autoIncrementColumn}" is AUTO_INCREMENT, a number should be returned for it.`,
            );
          }

          autoIncrementColumn.setValue(create, result.insertId);
        }

        return create;
      }),
    );
  }
}
