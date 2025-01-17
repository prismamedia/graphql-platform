import assert from 'node:assert';
import type { ForeignKeyInformation } from '../../../statement.js';
import type { DiagnosisError } from '../../diagnosis.js';
import type { ForeignKey } from '../foreign-key.js';

export type ForeignKeyDiagnosisOptions = {};

export type ForeignKeyDiagnosisSummary = {
  referencedTable?: DiagnosisError;
  referencedUniqueIndex?: DiagnosisError;
  onUpdate?: DiagnosisError;
  onDelete?: DiagnosisError;
};

export class ForeignKeyDiagnosis {
  public readonly referencedTableError?: DiagnosisError;
  public readonly referencedUniqueIndexError?: DiagnosisError;
  public readonly onUpdateError?: DiagnosisError;
  public readonly onDeleteError?: DiagnosisError;

  public readonly errorCount: number;

  public constructor(
    public readonly foreignKey: ForeignKey,
    information: ForeignKeyInformation,
    options?: ForeignKeyDiagnosisOptions,
  ) {
    assert.strictEqual(
      information.CONSTRAINT_SCHEMA,
      foreignKey.table.schema.name,
    );
    assert.strictEqual(information.TABLE_NAME, foreignKey.table.name);
    assert.strictEqual(information.CONSTRAINT_NAME, foreignKey.name);
    assert.strictEqual(
      information.UNIQUE_CONSTRAINT_SCHEMA,
      foreignKey.table.schema.name,
    );

    if (foreignKey.referencedTable.name !== information.REFERENCED_TABLE_NAME) {
      this.referencedTableError = {
        expected: foreignKey.referencedTable.name,
        actual: information.REFERENCED_TABLE_NAME,
      };
    }

    if (
      foreignKey.referencedIndex.name !== information.UNIQUE_CONSTRAINT_NAME
    ) {
      this.referencedUniqueIndexError = {
        expected: foreignKey.referencedIndex.name,
        actual: information.UNIQUE_CONSTRAINT_NAME,
      };
    }

    if (
      new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
        'RESTRICT',
        information.UPDATE_RULE,
      ) !== 0
    ) {
      this.onUpdateError = {
        expected: 'RESTRICT',
        actual: information.UPDATE_RULE,
      };
    }

    if (
      new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
        'RESTRICT',
        information.DELETE_RULE,
      ) !== 0
    ) {
      this.onDeleteError = {
        expected: 'RESTRICT',
        actual: information.DELETE_RULE,
      };
    }

    this.errorCount =
      (this.referencedTableError ? 1 : 0) +
      (this.referencedUniqueIndexError ? 1 : 0) +
      (this.onUpdateError ? 1 : 0) +
      (this.onDeleteError ? 1 : 0);
  }

  public isValid(): boolean {
    return !this.errorCount;
  }

  public summarize(): ForeignKeyDiagnosisSummary {
    return {
      ...(this.referencedTableError && {
        referencedTable: this.referencedTableError,
      }),
      ...(this.referencedUniqueIndexError && {
        referencedUniqueIndex: this.referencedUniqueIndexError,
      }),
      ...(this.onUpdateError && { onUpdate: this.onUpdateError }),
      ...(this.onDeleteError && { onDelete: this.onDeleteError }),
    };
  }
}
