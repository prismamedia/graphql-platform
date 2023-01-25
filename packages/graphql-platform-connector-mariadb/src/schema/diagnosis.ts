import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import type { Schema } from '../schema.js';
import { SchemaInformation, TableInformation } from '../statement.js';
import {
  TableDiagnosis,
  type ColumnInformationsByColumnName,
  type ForeignKeyInformationsByForeignKeyName,
  type IndexInformationsByColumnNameByIndexName,
  type Table,
  type TableDiagnosisOptions,
  type TableDiagnosisSummary,
} from './table.js';

export type DiagnosisError = {
  message?: string;
  expected: any;
  actual: any;
  hint?: string;
};

export type TableInformationsByTableName = Map<Table['name'], TableInformation>;

export type ColumnInformationsByColumnNameByTableName = Map<
  Table['name'],
  ColumnInformationsByColumnName
>;

export type IndexInformationsByIndexNameByTableName = Map<
  Table['name'],
  IndexInformationsByColumnNameByIndexName
>;

export type ForeignKeyInformationsByForeignKeyNameByTableName = Map<
  Table['name'],
  ForeignKeyInformationsByForeignKeyName
>;

export type SchemaDiagnosisInformations = {
  schema: SchemaInformation;
  tables: TableInformationsByTableName;
  columns: ColumnInformationsByColumnNameByTableName;
  indexes: IndexInformationsByIndexNameByTableName;
  foreignKeys: ForeignKeyInformationsByForeignKeyNameByTableName;
};

export type SchemaDiagnosisOptions = {
  charset?: utils.OptionalFlag;
  collation?: utils.OptionalFlag;
  comment?: utils.OptionalFlag;

  tables?: TableDiagnosisOptions;
  extraTables?: utils.OptionalFlag | Table['name'][];
};

export type SchemaDiagnosisSummary = {
  charset?: DiagnosisError;
  collation?: DiagnosisError;
  comment?: DiagnosisError;

  missingTables?: ReadonlyArray<Table['name']>;
  invalidTables?: Record<Table['name'], TableDiagnosisSummary>;
  extraTables?: ReadonlyArray<Table['name']>;
};

export class SchemaDiagnosis {
  public readonly charsetError?: DiagnosisError;
  public readonly collationError?: DiagnosisError;
  public readonly commentError?: DiagnosisError;

  public readonly diagnosesByTable: ReadonlyMap<Table, TableDiagnosis>;
  public readonly missingTables: ReadonlyArray<Table>;
  public readonly invalidTables: ReadonlyArray<TableDiagnosis>;
  public readonly extraTables: ReadonlyArray<Table['name']>;

  public constructor(
    public readonly schema: Schema,
    informations: SchemaDiagnosisInformations,
    options?: SchemaDiagnosisOptions,
  ) {
    // schema
    {
      assert.equal(informations.schema.SCHEMA_NAME, schema.name);

      if (
        utils.getOptionalFlag(options?.charset, true) &&
        new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
          schema.defaultCharset,
          informations.schema.DEFAULT_CHARACTER_SET_NAME,
        ) !== 0
      ) {
        this.charsetError = {
          expected: schema.defaultCharset,
          actual: informations.schema.DEFAULT_CHARACTER_SET_NAME,
        };
      }

      if (
        utils.getOptionalFlag(options?.collation, true) &&
        new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
          schema.defaultCollation,
          informations.schema.DEFAULT_COLLATION_NAME,
        ) !== 0
      ) {
        this.collationError = {
          expected: schema.defaultCollation,
          actual: informations.schema.DEFAULT_COLLATION_NAME,
        };
      }

      if (
        utils.getOptionalFlag(options?.comment, true) &&
        new Intl.Collator(undefined, { sensitivity: 'base' }).compare(
          schema.comment || '',
          informations.schema.SCHEMA_COMMENT || '',
        ) !== 0
      ) {
        this.commentError = {
          expected: schema.comment,
          actual: informations.schema.SCHEMA_COMMENT || undefined,
        };
      }
    }

    // tables
    {
      this.diagnosesByTable = new Map(
        schema.tables.reduce<[Table, TableDiagnosis][]>((entries, table) => {
          const tableInformation = informations.tables.get(table.name);
          if (tableInformation) {
            entries.push([
              table,
              new TableDiagnosis(
                table,
                {
                  table: tableInformation,
                  columns: informations.columns.get(table.name),
                  indexes: informations.indexes.get(table.name),
                  foreignKeys: informations.foreignKeys.get(table.name),
                },
                {
                  collation: options?.collation,
                  comment: options?.comment,
                  ...options?.tables,
                },
              ),
            ]);
          }

          return entries;
        }, []),
      );

      this.missingTables = schema.tables.filter(
        (table) => !informations.tables.has(table.name),
      );

      this.invalidTables = Array.from(this.diagnosesByTable.values()).filter(
        (diagnosis) => !diagnosis.isValid(),
      );

      const extraTableNames = Array.from(informations.tables.keys()).filter(
        (name) => !schema.tables.some((table) => table.name === name),
      );

      this.extraTables = Array.isArray(options?.extraTables)
        ? extraTableNames.filter(
            (extraTableName) =>
              !(options!.extraTables as Table['name'][]).includes(
                extraTableName,
              ),
          )
        : utils.getOptionalFlag(options?.extraTables, true)
        ? extraTableNames
        : [];
    }
  }

  public isValid(): boolean {
    return (
      !this.charsetError &&
      !this.collationError &&
      !this.commentError &&
      !this.missingTables.length &&
      !this.invalidTables.length &&
      !this.extraTables.length
    );
  }

  public summarize(): SchemaDiagnosisSummary {
    return {
      ...(this.charsetError && {
        charset: this.charsetError,
      }),
      ...(this.collationError && {
        collation: this.collationError,
      }),
      ...(this.commentError && { comment: this.commentError }),
      ...(this.missingTables.length && {
        missingTables: this.missingTables.map((table) => table.name),
      }),
      ...(this.invalidTables.length && {
        invalidTables: Object.fromEntries(
          this.invalidTables.map((diagnosis) => [
            diagnosis.table.name,
            diagnosis.summarize(),
          ]),
        ),
      }),
      ...(this.extraTables.length && {
        extraTables: this.extraTables,
      }),
    };
  }

  public printSummary(): string {
    return inspect(this.summarize(), undefined, 10);
  }
}
