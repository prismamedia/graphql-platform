import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { Column, Schema, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-check_constraints-table/
 */
export type ConstraintInformation = {
  CONSTRAINT_CATALOG: string;
  CONSTRAINT_SCHEMA: string;
  TABLE_NAME: string;
  LEVEL: string;
  CHECK_CLAUSE: 'Column' | 'Table';
  CONSTRAINT_NAME: string;
};

export type GetConstraintInformationStatementOptions = {
  table?: Table;
  column?: Column;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-columns-table/
 */
export class GetConstraintInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    options?: GetConstraintInformationStatementOptions,
  ) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS`,
      `WHERE ${[
        `CONSTRAINT_SCHEMA = ${escapeStringValue(schema.name)}`,
        options?.table &&
          `TABLE_NAME = ${escapeStringValue(options.table.name)}`,
        ...(options?.column
          ? [
              `LEVEL = ${escapeStringValue('Column')}`,
              `CONSTRAINT_NAME = ${escapeStringValue(options.column.name)}`,
            ]
          : []),
      ]
        .filter(Boolean)
        .join(' AND ')}`,
    ].join(EOL);
  }
}
