import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import { inspect } from 'node:util';
import * as R from 'remeda';
import type { Schema } from '../schema.js';
import type { SchemaInformation, TableInformation } from '../statement.js';
import { SchemaFix, type SchemaFixOptions } from './diagnosis/fix.js';
import {
  TableDiagnosis,
  type ColumnInformationsByColumnName,
  type ConstraintInformationsByColumnName,
  type ForeignKeyInformationsByForeignKeyName,
  type IndexInformationsByColumnNameByIndexName,
  type Table,
  type TableDiagnosisOptions,
  type TableDiagnosisSummary,
} from './table.js';

export * from './diagnosis/fix.js';

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

export type ConstraintInformationsByColumnNameByTableName = Map<
  Table['name'],
  ConstraintInformationsByColumnName
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
  constraints: ConstraintInformationsByColumnNameByTableName;
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
  errors: number;

  charset?: DiagnosisError;
  collation?: DiagnosisError;
  comment?: DiagnosisError;

  tables?: {
    extra?: ReadonlyArray<Table['name']>;
    missing?: ReadonlyArray<Table['name']>;
    invalid?: Record<Table['name'], TableDiagnosisSummary>;
  };
};

export class SchemaDiagnosis {
  public readonly charsetError?: DiagnosisError;
  public readonly collationError?: DiagnosisError;
  public readonly commentError?: DiagnosisError;

  public readonly diagnosesByTable: ReadonlyMap<Table, TableDiagnosis>;
  public readonly missingTables: ReadonlyArray<Table>;
  public readonly invalidTables: ReadonlyArray<TableDiagnosis>;
  public readonly extraTables: ReadonlyArray<Table['name']>;
  public readonly fixableTableNames: ReadonlyArray<Table['name']>;

  public readonly errorCount: number;

  public constructor(
    public readonly schema: Schema,
    informations: SchemaDiagnosisInformations,
    options?: SchemaDiagnosisOptions,
  ) {
    // schema
    {
      assert.strictEqual(informations.schema.SCHEMA_NAME, schema.name);

      if (
        utils.getOptionalFlag(options?.charset, true) &&
        utils.baseEnCollator.compare(
          schema.defaultCharset,
          informations.schema.DEFAULT_CHARACTER_SET_NAME,
        )
      ) {
        this.charsetError = {
          expected: schema.defaultCharset,
          actual: informations.schema.DEFAULT_CHARACTER_SET_NAME,
        };
      }

      if (
        utils.getOptionalFlag(options?.collation, true) &&
        utils.baseEnCollator.compare(
          schema.defaultCollation,
          informations.schema.DEFAULT_COLLATION_NAME,
        )
      ) {
        this.collationError = {
          expected: schema.defaultCollation,
          actual: informations.schema.DEFAULT_COLLATION_NAME,
        };
      }

      if (
        utils.getOptionalFlag(options?.comment, true) &&
        utils.baseEnCollator.compare(
          schema.comment || '',
          informations.schema.SCHEMA_COMMENT || '',
        )
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
                  constraints: informations.constraints.get(table.name),
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

      const extraTableNames = Array.from(informations.tables.keys())
        .filter((name) => !schema.tables.some((table) => table.name === name))
        .filter(
          (name) =>
            !schema.connector.broker ||
            ![
              schema.connector.broker.requestsTableName,
              schema.connector.broker.changesByRequestTableName,
            ].includes(name),
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

      this.fixableTableNames = Object.freeze([
        ...this.extraTables,
        ...this.missingTables.map(({ name }) => name),
        ...this.invalidTables.map(({ table: { name } }) => name),
      ]);
    }

    this.errorCount =
      (this.commentError ? 1 : 0) +
      (this.charsetError ? 1 : 0) +
      (this.collationError ? 1 : 0) +
      this.extraTables.length +
      R.sumBy(
        this.missingTables,
        ({ foreignKeys, indexes, columns }) =>
          foreignKeys.length + indexes.length + columns.length,
      ) +
      R.sumBy(this.invalidTables, ({ errorCount }) => errorCount);
  }

  public isValid(): boolean {
    return !this.errorCount;
  }

  public summarize(): SchemaDiagnosisSummary {
    return {
      errors: this.errorCount,

      ...(this.commentError && { comment: this.commentError }),
      ...(this.charsetError && {
        charset: this.charsetError,
      }),
      ...(this.collationError && {
        collation: this.collationError,
      }),
      ...((this.extraTables.length ||
        this.missingTables.length ||
        this.invalidTables.length) && {
        tables: {
          ...(this.extraTables.length && { extra: this.extraTables }),
          ...(this.missingTables.length && {
            missing: this.missingTables.map(({ name }) => name),
          }),
          ...(this.invalidTables.length && {
            invalid: Object.fromEntries(
              this.invalidTables.map((diagnosis) => [
                diagnosis.table.name,
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

  public async fix(options?: SchemaFixOptions): Promise<void> {
    return new SchemaFix(this, options).execute();
  }
}
