import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import * as R from 'remeda';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import { ForeignKey, Table } from '../../schema/table.js';
import { StatementKind } from '../kind.js';

export interface CreateTableStatementConfig {
  orReplace?: utils.OptionalFlag;
  ifNotExists?: utils.OptionalFlag;
  withForeignKeys?: boolean | ReadonlyArray<ForeignKey['name'] | ForeignKey>;
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
    const actualForeignKeys = R.filter(
      config?.withForeignKeys == null || config.withForeignKeys === true
        ? table.foreignKeys
        : config.withForeignKeys === false
          ? []
          : config.withForeignKeys.map((foreignKeyOrName) =>
              foreignKeyOrName instanceof ForeignKey
                ? foreignKeyOrName
                : table.foreignKeys.find(
                    ({ name }) => name === foreignKeyOrName,
                  ),
            ),
      R.isDefined,
    );

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
          ...table.indexes.map(({ definition }) => definition),
          ...actualForeignKeys.map(({ definition }) => definition),
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
