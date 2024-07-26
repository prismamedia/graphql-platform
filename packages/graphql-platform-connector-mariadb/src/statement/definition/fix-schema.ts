import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { Schema, SchemaFix } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-database/
 */
export class FixSchemaStatement implements mariadb.QueryOptions {
  public readonly schema: Schema;
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static supports(fix: SchemaFix): boolean {
    return fix.comment || fix.charset || fix.collation;
  }

  public constructor(public readonly fix: SchemaFix) {
    this.schema = fix.schema;

    this.sql = [
      `ALTER SCHEMA ${escapeIdentifier(fix.schema.name)}`,

      fix.comment && `COMMENT = ${escapeStringValue(fix.schema.comment ?? '')}`,

      fix.charset &&
        `DEFAULT CHARSET = ${escapeStringValue(fix.schema.defaultCharset)}`,

      fix.collation &&
        `DEFAULT COLLATE = ${escapeStringValue(fix.schema.defaultCollation)}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
