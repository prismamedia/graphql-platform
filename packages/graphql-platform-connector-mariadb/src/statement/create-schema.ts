import { EOL } from 'node:os';
import { AbstractStatement, OkPacket } from '../abstract-statement.js';
import { escapeIdentifier, escapeStringValue } from '../escape.js';
import type { Schema } from '../schema.js';

export interface CreateSchemaStatementConfig {
  orReplace?: boolean;
  ifNotExists?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/create-database/
 */
export class CreateSchemaStatement extends AbstractStatement<OkPacket> {
  public override readonly statement: string;

  public constructor(schema: Schema, config?: CreateSchemaStatementConfig) {
    super(schema.connector);

    this.statement = [
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
    ].join(EOL);
  }
}
