import * as utils from '@prismamedia/graphql-platform-utils';
import { OptionalFlag } from '@prismamedia/graphql-platform-utils';
import { EOL } from 'node:os';
import { AbstractStatement, OkPacket } from '../abstract-statement.js';
import { escapeIdentifier, escapeStringValue } from '../escape.js';
import { Table } from '../schema/table.js';

export interface CreateTableStatementConfig {
  orReplace?: utils.OptionalFlag;
  ifNotExists?: utils.OptionalFlag;
  withoutForeignKeys?: OptionalFlag;
}

/**
 * @see https://mariadb.com/kb/en/create-table/
 */
export class CreateTableStatement extends AbstractStatement<OkPacket> {
  public override readonly statement: string;

  public constructor(table: Table, config?: CreateTableStatementConfig) {
    super(table.schema.connector);

    this.statement = [
      [
        'CREATE',
        config?.orReplace && 'OR REPLACE',
        'TABLE',
        config?.ifNotExists && 'IF NOT EXISTS',
        `${escapeIdentifier(table.qualifiedName)}`,
        `(${EOL}${[
          ...Array.from(
            table.columns,
            ({ name, definition }) => `${escapeIdentifier(name)} ${definition}`,
          ),
          table.primaryKey.definition,
          ...Array.from(
            table.uniqueIndexesByUniqueConstraint.values(),
            ({ definition }) => definition,
          ),
          ...(config?.withoutForeignKeys !== true
            ? Array.from(
                table.foreignKeysByEdge.values(),
                ({ definition }) => definition,
              )
            : []),
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
