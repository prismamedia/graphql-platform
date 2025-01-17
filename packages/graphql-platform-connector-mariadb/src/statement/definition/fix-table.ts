import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import { InvalidTableFix, Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

export enum FixTableStatementStep {
  PREPARATION,
  EXECUTION,
}

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class FixTableStatement implements mariadb.QueryOptions {
  public readonly table: Table;
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static supports(
    fix: InvalidTableFix,
    step: FixTableStatementStep,
  ): boolean {
    return Boolean(
      step === FixTableStatementStep.PREPARATION
        ? fix.existingForeignKeysReferencingInvalidColumnsOrIndexes.length ||
            fix.invalidForeignKeys.length
        : fix.engine ||
            fix.collation ||
            fix.extraForeignKeys.length ||
            fix.creatableForeignKeysNotReferencingThisFixableResources.length ||
            fix.extraIndexes.length ||
            fix.invalidIndexes.length ||
            fix.missingIndexes.length ||
            fix.extraColumns.length ||
            fix.missingColumns.length ||
            fix.invalidColumns.length,
    );
  }

  public constructor(
    public readonly fix: InvalidTableFix,
    step: FixTableStatementStep,
  ) {
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
      (step === FixTableStatementStep.PREPARATION
        ? [
            ...fix.existingForeignKeysReferencingInvalidColumnsOrIndexes.map(
              ({ name }) => `DROP FOREIGN KEY ${escapeIdentifier(name)}`,
            ),

            ...fix.invalidForeignKeys.map(
              ({ foreignKey: { name } }) =>
                `DROP FOREIGN KEY ${escapeIdentifier(name)}`,
            ),
          ]
        : [
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
                `MODIFY COLUMN ${escapeIdentifier(column.name)} ${
                  column.isNullable()
                    ? column.definition
                    : column.getDefinition(!!nullableError && !fix.nullable)
                }`,
            ),

            ...fix.missingColumns.map(
              (column) =>
                `ADD COLUMN ${escapeIdentifier(column.name)} ${
                  column.isNullable()
                    ? column.definition
                    : column.getDefinition(!fix.nullable)
                }`,
            ),

            ...fix.invalidIndexes.map(
              ({ index: { definition } }) => `ADD ${definition}`,
            ),

            ...fix.missingIndexes.map(({ definition }) => `ADD ${definition}`),

            ...fix.creatableForeignKeysNotReferencingThisFixableResources.map(
              ({ definition }) => `ADD ${definition}`,
            ),
          ]
      )
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
