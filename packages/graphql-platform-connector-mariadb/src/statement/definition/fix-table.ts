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
    extraForeignKeys,
    extraIndexes,
    extraColumns,
    missingColumns,
    missingIndexes,
    missingForeignKeys,
    invalidForeignKeys,
    invalidIndexes,
  }: TableDiagnosis): boolean {
    return Boolean(
      engineError ||
        collationError ||
        invalidColumns.some((diagnosis) => diagnosis.collationError) ||
        commentError ||
        extraForeignKeys.length ||
        extraIndexes.length ||
        extraColumns.length ||
        missingColumns.length ||
        missingIndexes.length ||
        missingForeignKeys.length ||
        invalidForeignKeys.length ||
        invalidIndexes.length,
    );
  }

  public constructor({
    table,
    engineError,
    collationError,
    invalidColumns,
    commentError,
    extraForeignKeys,
    extraIndexes,
    extraColumns,
    missingColumns,
    missingIndexes,
    missingForeignKeys,
    invalidForeignKeys,
    invalidIndexes,
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
        ...extraForeignKeys.map(
          (foreignKey) => `DROP FOREIGN KEY ${escapeIdentifier(foreignKey)}`,
        ),
        ...extraIndexes.map((index) => `DROP INDEX ${escapeIdentifier(index)}`),
        ...extraColumns.map(
          (column) => `DROP COLUMN ${escapeIdentifier(column)}`,
        ),
        ...missingColumns.map(
          (column) =>
            `ADD COLUMN ${escapeIdentifier(column.name)} ${column.definition}`,
        ),
        ...missingIndexes.map((index) => `ADD ${index.definition}`),
        ...missingForeignKeys.map(
          (foreignKey) => `ADD ${foreignKey.definition}`,
        ),
        ...invalidForeignKeys.flatMap(({ foreignKey }) => [
          `DROP FOREIGN KEY ${escapeIdentifier(foreignKey.name)}`,
          `ADD ${foreignKey.definition}`,
        ]),
        ...invalidIndexes.flatMap(({ index }) => [
          `DROP INDEX ${escapeIdentifier(index.name)}`,
          `ADD ${index.definition}`,
        ]),
      ]
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
