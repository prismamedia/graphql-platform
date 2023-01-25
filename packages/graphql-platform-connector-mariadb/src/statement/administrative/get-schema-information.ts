import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeStringValue } from '../../escaping.js';
import type { Schema } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/information-schema-schemata-table/
 */
export type SchemaInformation = {
  SCHEMA_NAME: string;
  DEFAULT_CHARACTER_SET_NAME: string;
  DEFAULT_COLLATION_NAME: string;
  SCHEMA_COMMENT: string;
};

/**
 * @see https://mariadb.com/kb/en/information-schema-schemata-table/
 */
export class GetSchemaInformationStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.ADMINISTRATIVE;
  public readonly sql: string;

  public constructor(public readonly schema: Schema) {
    this.sql = [
      'SELECT *',
      `FROM INFORMATION_SCHEMA.SCHEMATA`,
      `WHERE SCHEMA_NAME = ${escapeStringValue(schema.name)}`,
    ].join(EOL);
  }
}
