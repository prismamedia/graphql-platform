import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { Index, Schema, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-statistics-table/
 */
export type IndexInformation = {
  TABLE_NAME: string;
  TABLE_SCHEMA: string;
  INDEX_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: 1n | 0n;
  INDEX_TYPE: 'BTREE' | 'RTREE' | 'HASH' | 'FULLTEXT';
};

export type GetIndexInformationStatementOptions = {
  table?: Table;
  index?: Index;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-columns-table/
 */
export class GetIndexInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    options?: GetIndexInformationStatementOptions,
  ) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.STATISTICS`,
      `WHERE ${[
        `TABLE_SCHEMA = ${escapeStringValue(schema.name)}`,
        options?.table &&
          `TABLE_NAME = ${escapeStringValue(options.table.name)}`,
        options?.index &&
          `INDEX_NAME = ${escapeStringValue(options.index.name)}`,
      ]
        .filter(Boolean)
        .join(' AND ')}`,
    ].join(EOL);
  }
}
