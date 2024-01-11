import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { TableDiagnosis, TableDiagnosisFixConfig } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class FixTableStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static fixes(
    diagnosis: TableDiagnosis,
    config?: TableDiagnosisFixConfig,
  ): boolean {
    return (
      diagnosis.fixesComment(config) ||
      diagnosis.fixesEngine(config) ||
      diagnosis.fixesCollation(config) ||
      diagnosis.fixesForeignKeys(config).length > 0 ||
      diagnosis.fixesIndexes(config).length > 0 ||
      diagnosis.fixesColumns(config).length > 0
    );
  }

  public constructor(
    diagnosis: TableDiagnosis,
    config?: TableDiagnosisFixConfig,
  ) {
    assert(
      (this.constructor as typeof FixTableStatement).fixes(diagnosis, config),
    );

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(diagnosis.table.qualifiedName)}`,
      [
        diagnosis.fixesComment(config) &&
          `COMMENT = ${escapeStringValue(diagnosis.table.comment ?? '')}`,

        diagnosis.fixesEngine(config) &&
          `ENGINE = ${escapeStringValue(diagnosis.table.engine)}`,

        ...(diagnosis.fixesCollation(config)
          ? [
              `CONVERT TO CHARACTER SET ${escapeStringValue(
                diagnosis.table.defaultCharset,
              )} COLLATE ${escapeStringValue(
                diagnosis.table.defaultCollation,
              )}`,
              `DEFAULT CHARSET = ${escapeStringValue(
                diagnosis.table.defaultCharset,
              )}`,
              `DEFAULT COLLATE = ${escapeStringValue(
                diagnosis.table.defaultCollation,
              )}`,
            ]
          : []),

        ...diagnosis.extraForeignKeys
          .filter((name) => diagnosis.fixesForeignKeys(config).includes(name))
          .map((name) => `DROP FOREIGN KEY ${escapeIdentifier(name)}`),

        ...diagnosis.invalidForeignKeys
          .filter(({ foreignKey: { name } }) =>
            diagnosis.fixesForeignKeys(config).includes(name),
          )
          .map(
            ({ foreignKey: { name } }) =>
              `DROP FOREIGN KEY ${escapeIdentifier(name)}`,
          ),

        ...diagnosis.extraIndexes
          .filter((name) => diagnosis.fixesIndexes(config).includes(name))
          .map((name) => `DROP INDEX ${escapeIdentifier(name)}`),

        ...diagnosis.invalidIndexes
          .filter(({ index: { name } }) =>
            diagnosis.fixesIndexes(config).includes(name),
          )
          .map(
            ({ index: { name } }) => `DROP INDEX  ${escapeIdentifier(name)}`,
          ),

        ...diagnosis.extraColumns
          .filter((name) => diagnosis.fixesColumns(config).includes(name))
          .map((name) => `DROP COLUMN ${escapeIdentifier(name)}`),

        ...diagnosis.invalidColumns
          .filter(({ column: { name } }) =>
            diagnosis.fixesColumns(config).includes(name),
          )
          .map(
            ({ column: { name, definition } }) =>
              `MODIFY COLUMN ${escapeIdentifier(name)} ${definition}`,
          ),

        ...diagnosis.missingColumns
          .filter(({ name }) => diagnosis.fixesColumns(config).includes(name))
          .map(
            ({ name, definition }) =>
              `ADD COLUMN ${escapeIdentifier(name)} ${definition}`,
          ),

        ...diagnosis.missingIndexes
          .filter(({ name }) => diagnosis.fixesIndexes(config).includes(name))
          .map(({ definition }) => `ADD ${definition}`),

        ...diagnosis.missingForeignKeys
          .filter(({ name }) =>
            diagnosis.fixesForeignKeys(config).includes(name),
          )
          .map(({ definition }) => `ADD ${definition}`),
      ]
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
