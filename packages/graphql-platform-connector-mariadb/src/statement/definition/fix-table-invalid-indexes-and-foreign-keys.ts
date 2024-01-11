import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import type { TableDiagnosis, TableDiagnosisFixConfig } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class FixTableInvalidIndexesAndForeignKeysStatement
  implements mariadb.QueryOptions
{
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public static fixes(
    diagnosis: TableDiagnosis,
    config?: TableDiagnosisFixConfig,
  ): boolean {
    return (
      diagnosis.invalidIndexes.some(({ index: { name } }) =>
        diagnosis.fixesIndexes(config).includes(name),
      ) ||
      diagnosis.invalidForeignKeys.some(({ foreignKey: { name } }) =>
        diagnosis.fixesForeignKeys(config).includes(name),
      )
    );
  }

  public constructor(
    diagnosis: TableDiagnosis,
    config?: TableDiagnosisFixConfig,
  ) {
    assert(
      (
        this.constructor as typeof FixTableInvalidIndexesAndForeignKeysStatement
      ).fixes(diagnosis, config),
    );

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(diagnosis.table.qualifiedName)}`,
      [
        ...diagnosis.invalidIndexes
          .filter(({ index: { name } }) =>
            diagnosis.fixesIndexes(config).includes(name),
          )
          .map(({ index: { definition } }) => `ADD ${definition}`),
        ...diagnosis.invalidForeignKeys
          .filter(({ foreignKey: { name } }) =>
            diagnosis.fixesForeignKeys(config).includes(name),
          )
          .map(({ foreignKey: { definition } }) => `ADD ${definition}`),
      ].join(`,${EOL}`),
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
