import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { Schema } from '../../schema.js';
import { StatementKind } from '../kind.js';

export interface CreateSchemaStatementConfig {
  orReplace?: boolean;
  ifNotExists?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/create-database/
 */
export class CreateSchemaStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    config?: CreateSchemaStatementConfig,
  ) {
    this.sql = [
      [
        'CREATE',
        config?.orReplace && 'OR REPLACE',
        'SCHEMA',
        config?.ifNotExists && 'IF NOT EXISTS',
        escapeIdentifier(schema.name),
      ]
        .filter(Boolean)
        .join(' '),
      `DEFAULT CHARSET = ${escapeStringValue(schema.defaultCharset)}`,
      `DEFAULT COLLATE = ${escapeStringValue(schema.defaultCollation)}`,
      schema.comment && `COMMENT = ${escapeStringValue(schema.comment)}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
