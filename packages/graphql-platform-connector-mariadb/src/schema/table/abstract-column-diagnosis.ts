import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type {
  ColumnInformation,
  ConstraintInformation,
} from '../../statement.js';
import type { DiagnosisError } from '../diagnosis.js';
import type { AbstractColumn } from './abstract-column.js';

export type ColumnDiagnosisInformations = {
  column: ColumnInformation;
  constraint: ConstraintInformation | undefined;
};

export type ColumnDiagnosisOptions = {
  autoIncrement?: utils.OptionalFlag;
  collation?: utils.OptionalFlag;
  comment?: utils.OptionalFlag;
  dataType?: utils.OptionalFlag;
  constraint?: utils.OptionalFlag;
  nullable?: utils.OptionalFlag;
};

export type ColumnDiagnosisSummary = {
  autoIncrement?: DiagnosisError;
  collation?: DiagnosisError;
  comment?: DiagnosisError;
  dataType?: DiagnosisError;
  constraint?: DiagnosisError;
  nullable?: DiagnosisError;
};

export abstract class AbstractColumnDiagnosis<
  TColumn extends AbstractColumn = any,
> {
  public readonly autoIncrementError?: DiagnosisError;
  public readonly collationError?: DiagnosisError;
  public readonly commentError?: DiagnosisError;
  public readonly dataTypeError?: DiagnosisError;
  public readonly constraintError?: DiagnosisError;
  public readonly nullableError?: DiagnosisError;

  public readonly errorCount: number;

  public constructor(
    public readonly column: TColumn,
    informations: ColumnDiagnosisInformations,
    options?: ColumnDiagnosisOptions,
  ) {
    assert.equal(informations.column.TABLE_SCHEMA, column.table.schema.name);
    assert.equal(informations.column.TABLE_NAME, column.table.name);
    assert.equal(informations.column.COLUMN_NAME, column.name);

    if (informations.constraint) {
      assert.equal(
        informations.constraint.CONSTRAINT_SCHEMA,
        column.table.schema.name,
      );
      assert.equal(informations.constraint.TABLE_NAME, column.table.name);
      assert.equal(informations.constraint.CONSTRAINT_NAME, column.name);
    }

    if (
      utils.getOptionalFlag(options?.autoIncrement, true) &&
      new RegExp('auto_increment', 'i').test(informations.column.EXTRA) !==
        column.isAutoIncrement()
    ) {
      this.autoIncrementError = {
        expected: column.isAutoIncrement(),
        actual: informations.column.EXTRA,
      };
    }

    if (
      utils.getOptionalFlag(options?.collation, true) &&
      'collation' in column.dataType &&
      informations.column.COLLATION_NAME &&
      (
        column.dataType.collation || column.table.defaultCollation
      ).localeCompare(informations.column.COLLATION_NAME, undefined, {
        sensitivity: 'base',
      }) !== 0
    ) {
      this.collationError = {
        expected: column.dataType.collation || column.table.defaultCollation,
        actual: informations.column.COLLATION_NAME,
      };
    }

    if (
      utils.getOptionalFlag(options?.comment, true) &&
      new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
        column.comment || '',
        informations.column.COLUMN_COMMENT || '',
      ) !== 0
    ) {
      this.commentError = {
        expected: column.comment,
        actual: informations.column.COLUMN_COMMENT || undefined,
      };
    }

    if (
      utils.getOptionalFlag(options?.dataType, true) &&
      !column.dataType.isInformationValid(informations.column)
    ) {
      this.dataTypeError = {
        expected: column.dataType.definition,
        actual: R.pipe(
          informations.column,
          R.pick([
            'DATA_TYPE',
            'CHARACTER_MAXIMUM_LENGTH',
            'CHARACTER_OCTET_LENGTH',
            'DATETIME_PRECISION',
            'NUMERIC_PRECISION',
            'NUMERIC_SCALE',
          ]),
          R.omitBy((value) => value == null),
        ),
      };
    }

    if (
      utils.getOptionalFlag(options?.constraint, true) &&
      new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
        column.constraint || '',
        informations.constraint?.CHECK_CLAUSE || '',
      ) !== 0
    ) {
      this.constraintError = {
        expected: column.constraint,
        actual: informations.constraint?.CHECK_CLAUSE,
      };
    }

    if (
      utils.getOptionalFlag(options?.nullable, true) &&
      (informations.column.IS_NULLABLE === 'YES') !== column.isNullable()
    ) {
      this.nullableError = {
        expected: column.isNullable(),
        actual: informations.column.IS_NULLABLE,
      };
    }

    this.errorCount =
      (this.commentError ? 1 : 0) +
      (this.autoIncrementError ? 1 : 0) +
      (this.collationError ? 1 : 0) +
      (this.dataTypeError ? 1 : 0) +
      (this.constraintError ? 1 : 0) +
      (this.nullableError ? 1 : 0);
  }

  public isValid(): boolean {
    return !this.errorCount;
  }

  public summarize(): ColumnDiagnosisSummary {
    return {
      ...(this.commentError && {
        comment: this.commentError,
      }),
      ...(this.autoIncrementError && {
        autoIncrement: this.autoIncrementError,
      }),
      ...(this.collationError && {
        collation: this.collationError,
      }),
      ...(this.dataTypeError && {
        dataType: this.dataTypeError,
      }),
      ...(this.constraintError && {
        constraint: this.constraintError,
      }),
      ...(this.nullableError && {
        nullable: this.nullableError,
      }),
    };
  }
}
