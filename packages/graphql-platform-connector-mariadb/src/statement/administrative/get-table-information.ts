import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { Schema, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-tables-table/
 */
export type TableInformation = {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: 'BASE TABLE' | 'VIEW' | 'SYSTEM VIEW';
  ENGINE: string;
  TABLE_COLLATION: string;
  TABLE_COMMENT: string;
};

export type GetTableInformationStatementOptions = {
  table?: Table;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-tables-table/
 */
export class GetTableInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    options?: GetTableInformationStatementOptions,
  ) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.TABLES`,
      `WHERE ${[
        `TABLE_SCHEMA = ${escapeStringValue(schema.name)}`,
        options?.table &&
          `TABLE_NAME = ${escapeStringValue(options.table.name)}`,
        `TABLE_TYPE = 'BASE TABLE'`,
      ]
        .filter(Boolean)
        .join(' AND ')}`,
    ].join(EOL);
  }
}
