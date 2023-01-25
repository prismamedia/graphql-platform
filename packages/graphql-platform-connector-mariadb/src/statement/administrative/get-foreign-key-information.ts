import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { ForeignKey, Schema, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-referential_constraints-table/
 */
export type ForeignKeyInformation = {
  CONSTRAINT_SCHEMA: string;
  CONSTRAINT_NAME: string;
  TABLE_NAME: string;

  UNIQUE_CONSTRAINT_SCHEMA: string;
  REFERENCED_TABLE_NAME: string;
  UNIQUE_CONSTRAINT_NAME: string;

  UPDATE_RULE:
    | 'CASCADE'
    | 'SET NULL'
    | 'SET DEFAULT'
    | 'RESTRICT'
    | 'NO ACTION';

  DELETE_RULE:
    | 'CASCADE'
    | 'SET NULL'
    | 'SET DEFAULT'
    | 'RESTRICT'
    | 'NO ACTION';
};

export type GetForeignKeyInformationStatementOptions = {
  table?: Table;
  foreignKey?: ForeignKey;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-referential_constraints-table/
 */
export class GetForeignKeyInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    options?: GetForeignKeyInformationStatementOptions,
  ) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS`,
      `WHERE ${[
        `CONSTRAINT_SCHEMA = ${escapeStringValue(schema.name)}`,
        options?.table &&
          `TABLE_NAME = ${escapeStringValue(options.table.name)}`,
        options?.foreignKey &&
          `CONSTRAINT_NAME = ${escapeStringValue(options.foreignKey.name)}`,
      ]
        .filter(Boolean)
        .join(' AND ')}`,
    ].join(EOL);
  }
}
