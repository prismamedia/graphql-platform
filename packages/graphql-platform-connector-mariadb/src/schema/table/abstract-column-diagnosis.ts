import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { ColumnInformation } from '../../statement.js';
import type { DiagnosisError } from '../diagnosis.js';
import type { AbstractColumn } from './abstract-column.js';

export type ColumnDiagnosisOptions = {
  autoIncrement?: utils.OptionalFlag;
  collation?: utils.OptionalFlag;
  comment?: utils.OptionalFlag;
  dataType?: utils.OptionalFlag;
  nullable?: utils.OptionalFlag;
};

export type ColumnDiagnosisSummary = {
  autoIncrement?: DiagnosisError;
  collation?: DiagnosisError;
  comment?: DiagnosisError;
  dataType?: DiagnosisError;
  nullable?: DiagnosisError;
};

export abstract class AbstractColumnDiagnosis<
  TColumn extends AbstractColumn = any,
> {
  public readonly autoIncrementError?: DiagnosisError;
  public readonly collationError?: DiagnosisError;
  public readonly commentError?: DiagnosisError;
  public readonly dataTypeError?: DiagnosisError;
  public readonly nullableError?: DiagnosisError;

  public constructor(
    public readonly column: TColumn,
    information: ColumnInformation,
    options?: ColumnDiagnosisOptions,
  ) {
    assert.equal(information.TABLE_SCHEMA, column.table.schema.name);
    assert.equal(information.TABLE_NAME, column.table.name);
    assert.equal(information.COLUMN_NAME, column.name);

    if (
      utils.getOptionalFlag(options?.autoIncrement, true) &&
      new RegExp('auto_increment', 'i').test(information.EXTRA) !==
        column.isAutoIncrement()
    ) {
      this.autoIncrementError = {
        expected: column.isAutoIncrement(),
        actual: information.EXTRA,
      };
    }

    if (
      utils.getOptionalFlag(options?.collation, true) &&
      'collation' in column.dataType &&
      information.COLLATION_NAME &&
      (
        column.dataType.collation || column.table.defaultCollation
      ).localeCompare(information.COLLATION_NAME, undefined, {
        sensitivity: 'base',
      }) !== 0
    ) {
      this.collationError = {
        expected: column.dataType.collation || column.table.defaultCollation,
        actual: information.COLLATION_NAME,
      };
    }

    if (
      utils.getOptionalFlag(options?.comment, true) &&
      new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
        column.comment || '',
        information.COLUMN_COMMENT || '',
      ) !== 0
    ) {
      this.commentError = {
        expected: column.comment,
        actual: information.COLUMN_COMMENT || undefined,
      };
    }

    if (
      utils.getOptionalFlag(options?.dataType, true) &&
      !column.dataType.isInformationValid(information)
    ) {
      this.dataTypeError = {
        expected: column.dataType.definition,
        actual: information.COLUMN_TYPE,
      };
    }

    if (
      utils.getOptionalFlag(options?.nullable, true) &&
      (information.IS_NULLABLE === 'YES') !== column.isNullable()
    ) {
      this.nullableError = {
        expected: column.isNullable(),
        actual: information.IS_NULLABLE,
      };
    }
  }

  public isValid(): boolean {
    return (
      !this.autoIncrementError &&
      !this.collationError &&
      !this.commentError &&
      !this.dataTypeError &&
      !this.nullableError
    );
  }

  public summarize(): ColumnDiagnosisSummary {
    return {
      ...(this.autoIncrementError && {
        autoIncrement: this.autoIncrementError,
      }),
      ...(this.collationError && {
        collation: this.collationError,
      }),
      ...(this.commentError && {
        comment: this.commentError,
      }),
      ...(this.dataTypeError && {
        dataType: this.dataTypeError,
      }),
      ...(this.nullableError && {
        nullable: this.nullableError,
      }),
    };
  }
}
