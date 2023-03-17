import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { Column, Schema, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-columns-table/
 */
export type ColumnInformation = {
  CHARACTER_MAXIMUM_LENGTH: bigint | null;
  CHARACTER_SET_NAME: string | null;
  COLLATION_NAME: string | null;
  COLUMN_COMMENT: string;
  COLUMN_DEFAULT: string | null;
  COLUMN_KEY: string;
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  DATA_TYPE: string;
  DATETIME_PRECISION: bigint | null;
  EXTRA: string;
  IS_NULLABLE: 'YES' | 'NO';
  NUMERIC_PRECISION: bigint | null;
  NUMERIC_SCALE: bigint | null;
  ORDINAL_POSITION: bigint;
  TABLE_NAME: string;
  TABLE_SCHEMA: string;
};

export type GetColumnInformationStatementOptions = {
  table?: Table;
  column?: Column;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-columns-table/
 */
export class GetColumnInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    options?: GetColumnInformationStatementOptions,
  ) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.COLUMNS`,
      `WHERE ${[
        `TABLE_SCHEMA = ${escapeStringValue(schema.name)}`,
        options?.table &&
          `TABLE_NAME = ${escapeStringValue(options.table.name)}`,
        options?.column &&
          `COLUMN_NAME = ${escapeStringValue(options.column.name)}`,
      ]
        .filter(Boolean)
        .join(' AND ')}`,
    ].join(EOL);
  }
}
