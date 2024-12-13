import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import { inspect } from 'node:util';
import * as R from 'remeda';
import {
  type ColumnInformation,
  type ConstraintInformation,
  type ForeignKeyInformation,
  type TableInformation,
} from '../../statement.js';
import type { DiagnosisError } from '../diagnosis.js';
import type { Table } from '../table.js';
import type {
  ColumnDiagnosisInformations,
  ColumnDiagnosisOptions,
  ColumnDiagnosisSummary,
} from './abstract-column-diagnosis.js';
import type {
  IndexDiagnosisOptions,
  IndexDiagnosisSummary,
  IndexInformationsByColumnName,
} from './abstract-index-diagnosis.js';
import {
  Column,
  ColumnDiagnosis,
  LeafColumn,
  LeafColumnDiagnosis,
  ReferenceColumnDiagnosis,
} from './column.js';
import type { InvalidTableFixOptions } from './diagnosis/fix.js';
import {
  type ForeignKey,
  ForeignKeyDiagnosis,
  type ForeignKeyDiagnosisOptions,
  type ForeignKeyDiagnosisSummary,
} from './foreign-key.js';
import {
  FullTextIndex,
  FullTextIndexDiagnosis,
  Index,
  IndexDiagnosis,
  PlainIndex,
  PlainIndexDiagnosis,
  PrimaryKey,
  PrimaryKeyDiagnosis,
  UniqueIndexDiagnosis,
} from './index.js';

export * from './diagnosis/fix.js';

export type ColumnInformationsByColumnName = Map<
  Column['name'],
  ColumnInformation
>;

export type ConstraintInformationsByColumnName = Map<
  Column['name'],
  ConstraintInformation
>;

export type IndexInformationsByColumnNameByIndexName = Map<
  Index['name'],
  IndexInformationsByColumnName
>;

export type ForeignKeyInformationsByForeignKeyName = Map<
  ForeignKey['name'],
  ForeignKeyInformation
>;

export type TableDiagnosisInformations = {
  table: TableInformation;
  columns: ColumnInformationsByColumnName | undefined;
  constraints: ConstraintInformationsByColumnName | undefined;
  indexes: IndexInformationsByColumnNameByIndexName | undefined;
  foreignKeys: ForeignKeyInformationsByForeignKeyName | undefined;
};

export type TableDiagnosisOptions = {
  comment?: utils.OptionalFlag;
  engine?: utils.OptionalFlag;
  collation?: utils.OptionalFlag;

  columns?: ColumnDiagnosisOptions;
  extraColumns?: utils.OptionalFlag | Column['name'][];

  indexes?: IndexDiagnosisOptions;
  extraIndexes?: utils.OptionalFlag | Index['name'][];

  foreignKeys?: ForeignKeyDiagnosisOptions;
  extraForeignKeys?: utils.OptionalFlag | ForeignKey['name'][];
};

export type TableDiagnosisSummary = {
  comment?: DiagnosisError;
  engine?: DiagnosisError;
  collation?: DiagnosisError;

  columns?: {
    extra?: ReadonlyArray<Column['name']>;
    missing?: ReadonlyArray<Column['name']>;
    invalid?: Record<Column['name'], ColumnDiagnosisSummary>;
  };

  indexes?: {
    extra?: ReadonlyArray<Index['name']>;
    missing?: ReadonlyArray<Index['name']>;
    invalid?: Record<Index['name'], IndexDiagnosisSummary>;
  };

  foreignKeys?: {
    extra?: ReadonlyArray<ForeignKey['name']>;
    missing?: ReadonlyArray<ForeignKey['name']>;
    invalid?: Record<ForeignKey['name'], ForeignKeyDiagnosisSummary>;
  };
};

export class TableDiagnosis {
  public readonly commentError?: DiagnosisError;
  public readonly engineError?: DiagnosisError;
  public readonly collationError?: DiagnosisError;

  public readonly diagnosesByColumn: ReadonlyMap<Column, ColumnDiagnosis>;
  public readonly missingColumns: ReadonlyArray<Column>;
  public readonly invalidColumns: ReadonlyArray<ColumnDiagnosis>;
  public readonly extraColumns: ReadonlyArray<Column['name']>;
  public readonly fixableColumnNames: ReadonlyArray<Column['name']>;

  public readonly diagnosesByIndex: ReadonlyMap<Index, IndexDiagnosis>;
  public readonly missingIndexes: ReadonlyArray<Index>;
  public readonly invalidIndexes: ReadonlyArray<IndexDiagnosis>;
  public readonly extraIndexes: ReadonlyArray<Index['name']>;
  public readonly fixableIndexNames: ReadonlyArray<Index['name']>;

  public readonly diagnosesByForeignKey: ReadonlyMap<
    ForeignKey,
    ForeignKeyDiagnosis
  >;
  public readonly missingForeignKeys: ReadonlyArray<ForeignKey>;
  public readonly invalidForeignKeys: ReadonlyArray<ForeignKeyDiagnosis>;
  public readonly extraForeignKeys: ReadonlyArray<ForeignKey['name']>;
  public readonly fixableForeignKeyNames: ReadonlyArray<ForeignKey['name']>;

  public readonly errorCount: number;

  public constructor(
    public readonly table: Table,
    informations: TableDiagnosisInformations,
    options?: TableDiagnosisOptions,
  ) {
    // table
    {
      assert.strictEqual(informations.table.TABLE_SCHEMA, table.schema.name);
      assert.strictEqual(informations.table.TABLE_NAME, table.name);

      if (
        utils.getOptionalFlag(options?.comment, true) &&
        utils.baseEnCollator.compare(
          table.comment || '',
          informations.table.TABLE_COMMENT || '',
        )
      ) {
        this.commentError = {
          expected: table.comment,
          actual: informations.table.TABLE_COMMENT || undefined,
        };
      }

      if (
        utils.getOptionalFlag(options?.engine, true) &&
        utils.baseEnCollator.compare(table.engine, informations.table.ENGINE)
      ) {
        this.engineError = {
          expected: table.engine,
          actual: informations.table.ENGINE,
        };
      }

      if (
        utils.getOptionalFlag(options?.collation, true) &&
        utils.baseEnCollator.compare(
          table.defaultCollation,
          informations.table.TABLE_COLLATION,
        )
      ) {
        this.collationError = {
          expected: table.defaultCollation,
          actual: informations.table.TABLE_COLLATION,
        };
      }
    }

    // columns
    {
      this.diagnosesByColumn = new Map(
        table.columns.reduce<[Column, ColumnDiagnosis][]>((entries, column) => {
          const columnInformation = informations.columns?.get(column.name);
          if (columnInformation) {
            const columnInformations: ColumnDiagnosisInformations = {
              column: columnInformation,
              constraint: informations.constraints?.get(column.name),
            };

            const columnDiagnosisOptions: ColumnDiagnosisOptions = {
              collation: options?.collation,
              comment: options?.comment,
              ...options?.columns,
            };

            entries.push([
              column,
              column instanceof LeafColumn
                ? new LeafColumnDiagnosis(
                    column,
                    columnInformations,
                    columnDiagnosisOptions,
                  )
                : new ReferenceColumnDiagnosis(
                    column,
                    columnInformations,
                    columnDiagnosisOptions,
                  ),
            ]);
          }

          return entries;
        }, []),
      );

      this.missingColumns = table.columns.filter(
        (column) => !informations.columns?.has(column.name),
      );

      this.invalidColumns = Array.from(this.diagnosesByColumn.values()).filter(
        (diagnosis) => !diagnosis.isValid(),
      );

      const extraColumnNames = informations.columns
        ? Array.from(informations.columns.keys()).filter(
            (name) => !table.columns.some((column) => column.name === name),
          )
        : [];

      this.extraColumns = Array.isArray(options?.extraColumns)
        ? extraColumnNames.filter(
            (extraColumnName) =>
              !(options!.extraColumns as Column['name'][]).includes(
                extraColumnName,
              ),
          )
        : utils.getOptionalFlag(options?.extraColumns, true)
          ? extraColumnNames
          : [];

      this.fixableColumnNames = Object.freeze([
        ...this.extraColumns,
        ...this.missingColumns.map(({ name }) => name),
        ...this.invalidColumns.map(({ column: { name } }) => name),
      ]);
    }

    // indexes
    {
      this.diagnosesByIndex = new Map(
        table.indexes.reduce<[Index, IndexDiagnosis][]>((entries, index) => {
          const indexInformationByColumnName = informations.indexes?.get(
            index.name,
          );

          if (indexInformationByColumnName) {
            const indexDiagnosisOptions: IndexDiagnosisOptions = {
              comment: options?.comment,
              ...options?.indexes,
            };

            entries.push([
              index,
              index instanceof FullTextIndex
                ? new FullTextIndexDiagnosis(
                    index,
                    indexInformationByColumnName,
                    indexDiagnosisOptions,
                  )
                : index instanceof PlainIndex
                  ? new PlainIndexDiagnosis(
                      index,
                      indexInformationByColumnName,
                      indexDiagnosisOptions,
                    )
                  : index instanceof PrimaryKey
                    ? new PrimaryKeyDiagnosis(
                        index,
                        indexInformationByColumnName,
                        indexDiagnosisOptions,
                      )
                    : new UniqueIndexDiagnosis(
                        index,
                        indexInformationByColumnName,
                        indexDiagnosisOptions,
                      ),
            ]);
          }

          return entries;
        }, []),
      );

      this.missingIndexes = table.indexes.filter(
        (index) => !informations.indexes?.has(index.name),
      );

      this.invalidIndexes = Array.from(this.diagnosesByIndex.values()).filter(
        (diagnosis) => !diagnosis.isValid(),
      );

      const extraIndexNames = informations.indexes
        ? Array.from(informations.indexes.keys()).filter(
            (name) =>
              !table.indexes.some((index) => index.name === name) &&
              !table.foreignKeys.some((fk) => fk.name === name),
          )
        : [];

      this.extraIndexes = Array.isArray(options?.extraIndexes)
        ? extraIndexNames.filter(
            (extraIndexName) =>
              !(options!.extraIndexes as Index['name'][]).includes(
                extraIndexName,
              ),
          )
        : utils.getOptionalFlag(options?.extraIndexes, true)
          ? extraIndexNames
          : [];

      this.fixableIndexNames = Object.freeze([
        ...this.extraIndexes,
        ...this.missingIndexes.map(({ name }) => name),
        ...this.invalidIndexes.map(({ index: { name } }) => name),
      ]);
    }

    // foreign-keys
    {
      this.diagnosesByForeignKey = new Map(
        table.foreignKeys.reduce<[ForeignKey, ForeignKeyDiagnosis][]>(
          (entries, foreignKey) => {
            const foreignKeyInformation = informations.foreignKeys?.get(
              foreignKey.name,
            );

            if (foreignKeyInformation) {
              const foreignKeyDiagnosisOptions: ForeignKeyDiagnosisOptions = {
                ...options?.foreignKeys,
              };

              entries.push([
                foreignKey,
                new ForeignKeyDiagnosis(
                  foreignKey,
                  foreignKeyInformation,
                  foreignKeyDiagnosisOptions,
                ),
              ]);
            }

            return entries;
          },
          [],
        ),
      );

      this.missingForeignKeys = table.foreignKeys.filter(
        (fk) => !informations.foreignKeys?.has(fk.name),
      );

      this.invalidForeignKeys = Array.from(
        this.diagnosesByForeignKey.values(),
      ).filter((diagnosis) => !diagnosis.isValid());

      const extraForeignKeyNames = informations.foreignKeys
        ? Array.from(informations.foreignKeys.keys()).filter(
            (name) => !table.foreignKeys.some((fk) => fk.name === name),
          )
        : [];

      this.extraForeignKeys = Array.isArray(options?.extraForeignKeys)
        ? extraForeignKeyNames.filter(
            (extraForeignKeyName) =>
              !(options!.extraForeignKeys as ForeignKey['name'][]).includes(
                extraForeignKeyName,
              ),
          )
        : utils.getOptionalFlag(options?.extraForeignKeys, true)
          ? extraForeignKeyNames
          : [];

      this.fixableForeignKeyNames = Object.freeze([
        ...this.extraForeignKeys,
        ...this.missingForeignKeys.map(({ name }) => name),
        ...this.invalidForeignKeys.map(({ foreignKey: { name } }) => name),
      ]);
    }

    this.errorCount =
      (this.commentError ? 1 : 0) +
      (this.engineError ? 1 : 0) +
      (this.collationError ? 1 : 0) +
      this.extraColumns.length +
      this.missingColumns.length +
      R.sumBy(this.invalidColumns, ({ errorCount }) => errorCount) +
      this.extraIndexes.length +
      this.missingIndexes.length +
      R.sumBy(this.invalidIndexes, ({ errorCount }) => errorCount) +
      this.extraForeignKeys.length +
      this.missingForeignKeys.length +
      R.sumBy(this.invalidForeignKeys, ({ errorCount }) => errorCount);
  }

  public isValid(): boolean {
    return !this.errorCount;
  }

  public summarize(): TableDiagnosisSummary {
    return {
      ...(this.commentError && { comment: this.commentError }),
      ...(this.engineError && { engine: this.engineError }),
      ...(this.collationError && {
        collation: this.collationError,
      }),

      ...((this.extraColumns.length ||
        this.missingColumns.length ||
        this.invalidColumns.length) && {
        columns: {
          ...(this.extraColumns.length && {
            extra: this.extraColumns,
          }),
          ...(this.missingColumns.length && {
            missing: this.missingColumns.map(({ name }) => name),
          }),
          ...(this.invalidColumns.length && {
            invalid: Object.fromEntries(
              this.invalidColumns.map((diagnosis) => [
                diagnosis.column.name,
                diagnosis.summarize(),
              ]),
            ),
          }),
        },
      }),

      ...((this.extraIndexes.length ||
        this.missingIndexes.length ||
        this.invalidIndexes.length) && {
        indexes: {
          ...(this.extraIndexes.length && {
            extra: this.extraIndexes,
          }),
          ...(this.missingIndexes.length && {
            missing: this.missingIndexes.map(({ name }) => name),
          }),
          ...(this.invalidIndexes.length && {
            invalid: Object.fromEntries(
              this.invalidIndexes.map((diagnosis) => [
                diagnosis.index.name,
                diagnosis.summarize(),
              ]),
            ),
          }),
        },
      }),

      ...((this.extraForeignKeys.length ||
        this.missingForeignKeys.length ||
        this.invalidForeignKeys.length) && {
        foreignKeys: {
          ...(this.extraForeignKeys.length && {
            extra: this.extraForeignKeys,
          }),
          ...(this.missingForeignKeys.length && {
            missing: this.missingForeignKeys.map(({ name }) => name),
          }),
          ...(this.invalidForeignKeys.length && {
            invalid: Object.fromEntries(
              this.invalidForeignKeys.map((diagnosis) => [
                diagnosis.foreignKey.name,
                diagnosis.summarize(),
              ]),
            ),
          }),
        },
      }),
    };
  }

  public printSummary(): string {
    return inspect(this.summarize(), undefined, 10);
  }

  public fixesColumns(config?: InvalidTableFixOptions): Array<Column['name']> {
    const fixableColumnNames =
      config?.columns == null || config.columns === true
        ? [...this.fixableColumnNames]
        : config.columns === false
          ? []
          : R.intersection(this.fixableColumnNames, config.columns);

    return utils.getOptionalFlag(config?.nullable, true)
      ? fixableColumnNames
      : fixableColumnNames.filter(
          (columnName) =>
            !this.invalidColumns.some(
              ({ column, errorCount, nullableError }) =>
                column.name === columnName &&
                !column.isNullable() &&
                errorCount === 1 &&
                nullableError,
            ),
        );
  }
}
