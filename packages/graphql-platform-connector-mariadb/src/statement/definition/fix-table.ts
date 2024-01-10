import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { TableDiagnosis } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class FixTableStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static supports({
    engineError,
    collationError,
    invalidColumns,
    commentError,
  }: TableDiagnosis): boolean {
    return Boolean(
      engineError ||
        collationError ||
        invalidColumns.some((diagnosis) => diagnosis.collationError) ||
        commentError,
    );
  }

  public constructor({
    table,
    engineError,
    collationError,
    invalidColumns,
    commentError,
  }: TableDiagnosis) {
    this.sql = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      [
        engineError && `ENGINE = ${escapeStringValue(table.engine)}`,
        collationError ||
          (invalidColumns.some((diagnosis) => diagnosis.collationError) &&
            `CONVERT TO CHARACTER SET ${escapeStringValue(
              table.defaultCharset,
            )} COLLATE ${escapeStringValue(table.defaultCollation)}`),
        collationError &&
          `DEFAULT CHARSET = ${escapeStringValue(table.defaultCharset)}`,
        collationError &&
          `DEFAULT COLLATE = ${escapeStringValue(table.defaultCollation)}`,
        commentError &&
          table.comment &&
          `COMMENT ${escapeStringValue(table.comment)}`,
      ]
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
