import type * as mariadb from 'mariadb';
import { escapeIdentifier } from '../../escaping.js';
import type { Schema } from '../../schema.js';
import { StatementKind } from '../kind.js';

export interface DropSchemaStatementConfig {
  ifExists?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/drop-database/
 */
export class DropSchemaStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly schema: Schema,
    config?: DropSchemaStatementConfig,
  ) {
    this.sql = [
      'DROP SCHEMA',
      config?.ifExists && 'IF EXISTS',
      escapeIdentifier(schema.name),
    ]
      .filter(Boolean)
      .join(' ');
  }
}
