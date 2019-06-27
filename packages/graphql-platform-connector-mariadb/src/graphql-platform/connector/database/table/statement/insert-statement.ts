import { QueryOptions } from 'mysql';
import { Table } from '../../table';
import { AssignmentSet } from './insert-statement/assignment';

/**
 * cf: https://dev.mysql.com/doc/refman/8.0/en/insert.html
 */
export class InsertStatement implements QueryOptions {
  readonly assignmentList: AssignmentSet;

  public constructor(readonly table: Table) {
    this.assignmentList = new AssignmentSet(table);
  }

  public get sql() {
    return [
      `INSERT INTO ${this.table.getEscapedName()}`,
      this.assignmentList.sql ? `SET ${this.assignmentList.sql}` : 'VALUES()',
      ';',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
