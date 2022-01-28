import { AbstractStatement, OkPacket } from '../abstract-statement.js';
import { escapeIdentifier } from '../escape.js';
import type { Schema } from '../schema.js';

export interface DropSchemaStatementConfig {
  ifExists?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/drop-database/
 */
export class DropSchemaStatement extends AbstractStatement<OkPacket> {
  public override readonly statement: string;

  public constructor(schema: Schema, config?: DropSchemaStatementConfig) {
    super(schema.connector);

    this.statement = [
      'DROP',
      'SCHEMA',
      config?.ifExists && 'IF EXISTS',
      escapeIdentifier(schema.name),
    ]
      .filter(Boolean)
      .join(' ');
  }
}
