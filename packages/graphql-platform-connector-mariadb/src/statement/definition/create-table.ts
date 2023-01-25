import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import { Table } from '../../schema/table.js';
import { StatementKind } from '../kind.js';

export interface CreateTableStatementConfig {
  orReplace?: utils.OptionalFlag;
  ifNotExists?: utils.OptionalFlag;
  withoutForeignKeys?: utils.OptionalFlag;
}

/**
 * @see https://mariadb.com/kb/en/create-table/
 */
export class CreateTableStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    config?: CreateTableStatementConfig,
  ) {
    this.sql = [
      [
        'CREATE',
        utils.getOptionalFlag(config?.orReplace, false) && 'OR REPLACE',
        'TABLE',
        utils.getOptionalFlag(config?.ifNotExists, false) && 'IF NOT EXISTS',
        `${escapeIdentifier(table.qualifiedName)}`,
        `(${EOL}${[
          ...table.columns.map(
            ({ name, definition }) => `${escapeIdentifier(name)} ${definition}`,
          ),
          ...table.indexes.map((idx) => idx.definition),
          ...(utils.getOptionalFlag(config?.withoutForeignKeys, false)
            ? []
            : table.foreignKeys.map((fk) => fk.definition)),
        ]
          .map((line) => `  ${line}`)
          .join(`,${EOL}`)}${EOL})`,
      ]
        .filter(Boolean)
        .join(' '),
      `ENGINE = ${escapeStringValue(table.engine)}`,
      `DEFAULT CHARSET = ${escapeStringValue(table.defaultCharset)}`,
      `DEFAULT COLLATE = ${escapeStringValue(table.defaultCollation)}`,
      table.comment && `COMMENT ${escapeStringValue(table.comment)}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
