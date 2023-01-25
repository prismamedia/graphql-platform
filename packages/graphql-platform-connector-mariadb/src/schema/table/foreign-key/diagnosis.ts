import assert from 'node:assert/strict';
import type { ForeignKeyInformation } from '../../../statement.js';
import { DiagnosisError } from '../../diagnosis.js';
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

  public constructor(
    public readonly foreignKey: ForeignKey,
    information: ForeignKeyInformation,
    options?: ForeignKeyDiagnosisOptions,
  ) {
    assert.equal(information.CONSTRAINT_SCHEMA, foreignKey.table.schema.name);
    assert.equal(information.TABLE_NAME, foreignKey.table.name);
    assert.equal(information.CONSTRAINT_NAME, foreignKey.name);
    assert.equal(
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
  }

  public isValid(): boolean {
    return (
      !this.referencedTableError &&
      !this.referencedUniqueIndexError &&
      !this.onUpdateError &&
      !this.onDeleteError
    );
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
