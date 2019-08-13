import { ConnectorCreateOperationArgs, ConnectorCreateOperationResult } from '@prismamedia/graphql-platform-core';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';

export class CreateOperation extends AbstractOperationResolver<
  ConnectorCreateOperationArgs,
  ConnectorCreateOperationResult
> {
  public async execute({
    args: { data: creates },
    context,
  }: OperationResolverParams<ConnectorCreateOperationArgs>): Promise<ConnectorCreateOperationResult> {
    return Promise.all(
      creates.map(async create => {
        const insertStatement = this.table.newInsertStatement();

        for (const component of this.resource.getComponentSet()) {
          if (component.isField()) {
            if (component.isList()) {
              throw new Error(`Not implemented, yet`);
            } else {
              const fieldValue = create.get(component);
              if (typeof fieldValue !== 'undefined') {
                const column = this.table.getColumn(component);
                insertStatement.assignmentList.addAssignment(column, column.getValue(fieldValue));
              }
            }
          } else {
            if (component.isList()) {
              throw new Error(`Not implemented, yet`);
            } else {
              const relationValue = create.get(component);
              if (typeof relationValue !== 'undefined') {
                for (const column of this.table.getForeignKey(component).getColumnSet()) {
                  insertStatement.assignmentList.addAssignment(column, column.getValue(relationValue));
                }
              }
            }
          }
        }

        const result = await this.connector.query(insertStatement.sql, context.connectorRequest.connection);

        const autoIncrementColumn = this.table.getAutoIncrementColumn();
        if (autoIncrementColumn) {
          if (!('insertId' in result && typeof result.insertId === 'number')) {
            throw new Error(
              `As the column "${autoIncrementColumn}" is AUTO_INCREMENT, a number should be returned for it: "${result}" have been returned`,
            );
          }

          create.set(autoIncrementColumn.field, result.insertId);
        }

        return create;
      }),
    );
  }
}
