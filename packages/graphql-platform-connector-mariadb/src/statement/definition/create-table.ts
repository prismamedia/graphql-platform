import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { Table } from '../../schema/table.js';
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
  public readonly kind = StatementKind.DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    config?: CreateTableStatementConfig,
  ) {
    this.sql = [
      [
        'CREATE',
        config?.orReplace && 'OR REPLACE',
        'TABLE',
        config?.ifNotExists && 'IF NOT EXISTS',
        `${escapeIdentifier(table.qualifiedName)}`,
        `(${EOL}${[
          ...table.columns.map(
            ({ name, definition }) => `${escapeIdentifier(name)} ${definition}`,
          ),
          table.primaryKey.definition,
          ...Array.from(
            table.uniqueIndexesByUniqueConstraint.values(),
            ({ definition }) => definition,
          ),
          ...(config?.withoutForeignKeys !== true
            ? Array.from(
                table.foreignKeyIndexesByEdge.values(),
                ({ definition }) => definition,
              )
            : []),
          ...table.fullTextIndexes.map(({ definition }) => definition),
          ...table.plainIndexes.map(({ definition }) => definition),
        ]
          .filter(Boolean)
          .map((line) => `  ${line}`)
          .join(`,${EOL}`)}${EOL})`,
      ]
        .filter(Boolean)
        .join(' '),
      `ENGINE = ${escapeStringValue(table.engine)}`,
      `DEFAULT CHARSET = ${escapeStringValue(table.defaultCharset)}`,
      `DEFAULT COLLATE = ${escapeStringValue(table.defaultCollation)}`,
      table.node.description &&
        `COMMENT ${escapeStringValue(
          table.node.description.substring(0, 2048),
        )}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
