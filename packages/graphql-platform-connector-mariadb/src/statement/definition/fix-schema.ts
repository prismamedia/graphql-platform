import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { SchemaDiagnosis } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-database/
 */
export class FixSchemaStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static supports({
    charsetError,
    collationError,
  }: SchemaDiagnosis): boolean {
    return Boolean(charsetError || collationError);
  }

  public constructor({
    schema,
    charsetError,
    collationError,
  }: SchemaDiagnosis) {
    this.sql = [
      `ALTER SCHEMA ${escapeIdentifier(schema.name)}`,
      charsetError &&
        `DEFAULT CHARSET = ${escapeStringValue(schema.defaultCharset)}`,
      collationError &&
        `DEFAULT COLLATE = ${escapeStringValue(schema.defaultCollation)}`,
    ].join(EOL);
  }
}
