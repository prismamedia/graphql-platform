import {
  ConnectorUpdateOperationArgs,
  ConnectorUpdateOperationResult,
} from '@prismamedia/graphql-platform-core';
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

    for (const component of this.resource.getComponentSet()) {
      if (component.isField()) {
        const fieldValue = update.get(component);
        if (typeof fieldValue !== 'undefined') {
          const column = this.table.getColumn(component);
          updateStatement.assignmentList.addAssignment(
            column,
            column.getValue(fieldValue),
          );
        }
      } else {
        const relationValue = update.get(component);
        if (typeof relationValue !== 'undefined') {
          for (const column of this.table
            .getForeignKey(component)
            .getColumnSet()) {
            updateStatement.assignmentList.addAssignment(
              column,
              column.getValue(relationValue),
            );
          }
        }
      }
    }

    await this.table
      .getOperation('Find')
      .parseWhereArg(updateStatement.where, where);

    const result = await this.connector.query(
      updateStatement.sql,
      context.connectorRequest.connection,
    );

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

    throw new Error(
      `An error occurred: the result has to be a positive integer, "${result}" have been returned`,
    );
  }
}
