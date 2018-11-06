import { Maybe } from '@prismamedia/graphql-platform-utils';
import { QueryOptions } from 'mysql';
import { Table } from '../../table';
import { OrderByExpressionSet } from './order-by';
import { TableFactor, TableReference } from './reference';
import { AssignmentSet } from './update-statement/assignment';
import { WhereConditionAnd } from './where';

/**
 * cf: https://dev.mysql.com/doc/refman/8.0/en/update.html
 */
export class UpdateStatement implements QueryOptions {
  readonly from: TableReference;
  readonly assignmentList: AssignmentSet;
  readonly where: WhereConditionAnd;
  readonly orderBy: OrderByExpressionSet;
  public limit?: Maybe<number>;

  public constructor(table: Table) {
    this.from = new TableFactor(table);
    this.assignmentList = new AssignmentSet(this.from);
    this.where = new WhereConditionAnd(this.from);
    this.orderBy = new OrderByExpressionSet(this.from);
  }

  public get sql(): string {
    return [
      `UPDATE ${this.from.sql}`,
      `SET ${this.assignmentList.sql}`,
      this.where.sql ? `WHERE ${this.where.sql}` : null,
      this.orderBy.sql ? `ORDER BY ${this.orderBy.sql}` : null,
      typeof this.limit === 'number' ? `LIMIT ${this.limit}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
