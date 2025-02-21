import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import { Event } from '../../schema/event.js';
import { StatementKind } from '../kind.js';

export interface CreateEventStatementConfig {
  orReplace?: utils.OptionalFlag;
  ifNotExists?: utils.OptionalFlag;
}

/**
 * @see https://mariadb.com/kb/en/create-event/
 */
export class CreateEventStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly event: Event,
    config?: CreateEventStatementConfig,
  ) {
    this.sql = [
      [
        'CREATE',
        utils.getOptionalFlag(config?.orReplace, false) && 'OR REPLACE',
        'EVENT',
        utils.getOptionalFlag(config?.ifNotExists, false) && 'IF NOT EXISTS',
        `${escapeIdentifier(event.qualifiedName)}`,
      ]
        .filter(Boolean)
        .join(' '),
      `ON SCHEDULE ${event.schedule}`,
      `DO ${event.statement};`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
