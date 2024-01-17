import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import * as R from 'remeda';
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
      R.intersection(
        diagnosis.extraForeignKeys,
        diagnosis.fixesForeignKeys(config),
      ).length > 0 ||
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

    const fixableForeignKeys = diagnosis.fixesForeignKeys(config);
    const fixableIndexes = diagnosis.fixesIndexes(config);
    const fixableColumns = diagnosis.fixesColumns(config);

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
          .filter((name) => fixableForeignKeys.includes(name))
          .map((name) => `DROP FOREIGN KEY ${escapeIdentifier(name)}`),

        ...diagnosis.extraIndexes
          .filter((name) => fixableIndexes.includes(name))
          .map((name) => `DROP INDEX ${escapeIdentifier(name)}`),

        ...diagnosis.invalidIndexes
          .filter(({ index: { name } }) => fixableIndexes.includes(name))
          .map(({ index: { name } }) => `DROP INDEX ${escapeIdentifier(name)}`),

        ...diagnosis.extraColumns
          .filter((name) => fixableColumns.includes(name))
          .map((name) => `DROP COLUMN ${escapeIdentifier(name)}`),

        ...diagnosis.invalidColumns
          .filter(({ column: { name } }) => fixableColumns.includes(name))
          .map(
            ({ column, nullableError }) =>
              `MODIFY COLUMN ${escapeIdentifier(column.name)} ${
                nullableError &&
                !utils.getOptionalFlag(config?.nullable, true) &&
                !column.isNullable()
                  ? column.getDefinition(true)
                  : column.definition
              }`,
          ),

        ...diagnosis.missingColumns
          .filter(({ name }) => fixableColumns.includes(name))
          .map(
            (column) =>
              `ADD COLUMN ${escapeIdentifier(column.name)} ${
                !utils.getOptionalFlag(config?.nullable, true) &&
                !column.isNullable()
                  ? column.getDefinition(true)
                  : column.definition
              }`,
          ),

        ...diagnosis.invalidIndexes
          .filter(({ index: { name } }) => fixableIndexes.includes(name))
          .map(({ index: { definition } }) => `ADD ${definition}`),

        ...diagnosis.missingIndexes
          .filter(({ name }) => fixableIndexes.includes(name))
          .map(({ definition }) => `ADD ${definition}`),
      ]
        .filter(Boolean)
        .join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
