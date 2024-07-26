import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { InvalidTableFix, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class FixTableStatement implements mariadb.QueryOptions {
  public readonly table: Table;
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static supports(fix: InvalidTableFix): boolean {
    return Boolean(
      fix.comment ||
        fix.engine ||
        fix.collation ||
        fix.extraForeignKeys.length ||
        fix.missingForeignKeys.length ||
        fix.invalidForeignKeys.length ||
        fix.extraIndexes.length ||
        fix.missingIndexes.length ||
        fix.invalidIndexes.length ||
        fix.extraColumns.length ||
        fix.missingColumns.length ||
        fix.invalidColumns.length,
    );
  }

  public constructor(public readonly fix: InvalidTableFix) {
    this.table = fix.table;

    this.sql = [
      [
        'ALTER',
        fix.ignore && 'IGNORE',
        'TABLE',
        escapeIdentifier(fix.table.qualifiedName),
      ]
        .filter(Boolean)
        .join(' '),
      [
        fix.comment &&
          `COMMENT = ${escapeStringValue(fix.table.comment ?? '')}`,

        fix.engine && `ENGINE = ${escapeStringValue(fix.table.engine)}`,

        ...(fix.collation
          ? [
              `CONVERT TO CHARACTER SET ${escapeStringValue(fix.table.defaultCharset)} COLLATE ${escapeStringValue(fix.table.defaultCollation)}`,
              `DEFAULT CHARSET = ${escapeStringValue(fix.table.defaultCharset)}`,
              `DEFAULT COLLATE = ${escapeStringValue(fix.table.defaultCollation)}`,
            ]
          : []),

        ...fix.extraForeignKeys.map(
          (name) => `DROP FOREIGN KEY ${escapeIdentifier(name)}`,
        ),

        ...fix.invalidForeignKeys.map(
          ({ foreignKey: { name } }) =>
            `DROP FOREIGN KEY ${escapeIdentifier(name)}`,
        ),

        ...fix.extraIndexes.map(
          (name) => `DROP INDEX ${escapeIdentifier(name)}`,
        ),

        ...fix.invalidIndexes.map(
          ({ index: { name } }) => `DROP INDEX ${escapeIdentifier(name)}`,
        ),

        ...fix.extraColumns.map(
          (name) => `DROP COLUMN ${escapeIdentifier(name)}`,
        ),

        ...fix.invalidColumns.map(
          ({ column, nullableError }) =>
            `MODIFY COLUMN ${escapeIdentifier(column.name)} ${nullableError && !fix.nullable && !column.isNullable() ? column.getDefinition(true) : column.definition}`,
        ),

        ...fix.missingColumns.map(
          (column) =>
            `ADD COLUMN ${escapeIdentifier(column.name)} ${!fix.nullable && !column.isNullable() ? column.getDefinition(true) : column.definition}`,
        ),

        ...fix.invalidIndexes.map(
          ({ index: { definition } }) => `ADD ${definition}`,
        ),

        ...fix.missingIndexes.map(({ definition }) => `ADD ${definition}`),

        ...fix.invalidForeignKeys.map(
          ({ foreignKey: { definition } }) => `ADD ${definition}`,
        ),

        ...fix.missingForeignKeys.map(({ definition }) => `ADD ${definition}`),
      ]
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
