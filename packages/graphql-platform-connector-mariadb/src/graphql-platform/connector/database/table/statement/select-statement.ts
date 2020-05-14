import { Maybe } from '@prismamedia/graphql-platform-utils';
import { QueryOptions } from 'mysql';
import { Table } from '../../table';
import { OrderByExpressionSet } from './order-by';
import { TableFactor, TableReference } from './reference';
import { GroupByExpressionSet } from './select-statement/group-by';
import { SelectExpressionSet } from './select-statement/select';
import { WhereConditionAnd } from './where';

export * from './select-statement/group-by';
export * from './select-statement/select';

/**
 * cf: https://dev.mysql.com/doc/refman/8.0/en/select.html
 */
export class SelectStatement implements QueryOptions {
  readonly select: SelectExpressionSet;
  readonly from: TableReference;
  readonly where: WhereConditionAnd;
  readonly groupBy: GroupByExpressionSet;
  readonly orderBy: OrderByExpressionSet;
  public limit?: Maybe<number>;
  public offset?: Maybe<number>;
  public forUpdate?: Maybe<boolean>;

  public constructor(table: Table) {
    this.from = new TableFactor(table);
    this.select = new SelectExpressionSet(this.from);
    this.where = new WhereConditionAnd(this.from);
    this.groupBy = new GroupByExpressionSet(this.from);
    this.orderBy = new OrderByExpressionSet(this.from);
  }

  public get sql(): string {
    return [
      `SELECT ${this.select.sql}`,
      `FROM ${this.from.sql}`,
      this.where.sql ? `WHERE ${this.where.sql}` : null,
      this.groupBy.sql ? `GROUP BY ${this.groupBy.sql}` : null,
      this.orderBy.sql ? `ORDER BY ${this.orderBy.sql}` : null,
      typeof this.limit === 'number' ? `LIMIT ${this.limit}` : null,
      typeof this.offset === 'number' && this.offset > 0
        ? `OFFSET ${this.offset}`
        : null,
      typeof this.forUpdate === 'boolean' && this.forUpdate
        ? `FOR UPDATE`
        : null,
      ';',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
