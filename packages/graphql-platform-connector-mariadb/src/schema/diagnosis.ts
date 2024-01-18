import * as utils from '@prismamedia/graphql-platform-utils';
import type { Connection } from 'mariadb';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as R from 'remeda';
import { escapeIdentifier } from '../escaping.js';
import type { ForeignKey, Schema, TableDiagnosisFixConfig } from '../schema.js';
import {
  FixSchemaStatement,
  SchemaInformation,
  StatementKind,
  TableInformation,
} from '../statement.js';
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

export type SchemaDiagnosisFixConfig = {
  charset?: boolean;
  collation?: boolean;
  columns?: boolean;
  comment?: boolean;
  engine?: boolean;
  foreignKeys?: boolean;
  indexes?: boolean;
  nullable?: boolean;

  tables?:
    | boolean
    | ReadonlyArray<Table['name']>
    | Record<Table['name'], boolean | TableDiagnosisFixConfig>;
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

  public fixesComment(config?: SchemaDiagnosisFixConfig): boolean {
    return Boolean(
      this.commentError && utils.getOptionalFlag(config?.comment, true),
    );
  }

  public fixesCharset(config?: SchemaDiagnosisFixConfig): boolean {
    return Boolean(
      this.charsetError && utils.getOptionalFlag(config?.charset, true),
    );
  }

  public fixesCollation(config?: SchemaDiagnosisFixConfig): boolean {
    return Boolean(
      this.collationError && utils.getOptionalFlag(config?.collation, true),
    );
  }

  public fixesTables(
    config?: SchemaDiagnosisFixConfig,
  ): Record<Table['name'], TableDiagnosisFixConfig> {
    const defaults: TableDiagnosisFixConfig = {
      collation: config?.collation,
      columns: config?.columns,
      comment: config?.comment,
      engine: config?.engine,
      foreignKeys: config?.foreignKeys,
      indexes: config?.indexes,
      nullable: config?.nullable,
    };

    return Object.fromEntries<TableDiagnosisFixConfig>(
      config?.tables == null || config.tables === true
        ? this.fixableTableNames.map((name) => [name, defaults])
        : config.tables === false
        ? []
        : Array.isArray(config.tables)
        ? config.tables.map((name) => [name, defaults])
        : Object.entries(config.tables)
            .filter(
              (entry): entry is [string, true | TableDiagnosisFixConfig] =>
                entry[1] !== false,
            )
            .map(([name, config]) => [
              name,
              config === true ? defaults : { ...defaults, ...config },
            ]),
    );
  }

  protected async doFixWithConnection(
    config: SchemaDiagnosisFixConfig | undefined,
    connection: Connection,
  ): Promise<void> {
    if (FixSchemaStatement.fixes(this, config)) {
      await this.schema.connector.executeStatement(
        new FixSchemaStatement(this, config),
        connection,
      );
    }

    const configsByTable = this.fixesTables(config);

    await Promise.all(
      this.extraTables.map(async (tableName) => {
        const config = configsByTable[tableName];
        if (config) {
          await connection.query(
            `DROP TABLE IF EXISTS ${escapeIdentifier(
              `${this.schema.name}.${tableName}`,
            )}`,
          );
        }
      }),
    );

    await Promise.all(
      this.missingTables.map(async (table) => {
        const config = configsByTable[table.name];
        if (config) {
          await table.create({ withoutForeignKeys: true }, connection);
        }
      }),
    );

    const invalidColumns = this.invalidTables.flatMap((tableDiagnosis) => {
      const config = configsByTable[tableDiagnosis.table.name];

      return config
        ? R.pipe(
            tableDiagnosis.invalidColumns,
            R.map(({ column }) => column),
            R.intersectionWith(
              tableDiagnosis.fixesColumns(config),
              (a, b) => a.name === b,
            ),
          )
        : [];
    });

    const invalidForeignKeysByTable = new Map<Table, ForeignKey[]>(
      this.schema.tables.map((table) => {
        const tableDiagnosis = this.diagnosesByTable.get(table);
        const config = configsByTable[table.name];

        const invalidForeignKeys: ForeignKey[] =
          tableDiagnosis && config
            ? R.pipe(
                tableDiagnosis.invalidForeignKeys,
                R.map(({ foreignKey }) => foreignKey),
                R.intersectionWith(
                  tableDiagnosis.fixesForeignKeys(config),
                  (a, b) => a.name === b,
                ),
              )
            : [];

        return [
          table,
          table.foreignKeys.filter(
            (foreignKey) =>
              invalidForeignKeys.includes(foreignKey) ||
              (foreignKey.columns.some(
                (column) =>
                  invalidColumns.includes(column) ||
                  invalidColumns.includes(column.referencedColumn),
              ) &&
                !this.missingTables.includes(table) &&
                !tableDiagnosis?.missingForeignKeys.includes(foreignKey)),
          ),
        ];
      }),
    );

    await Promise.all(
      Array.from(invalidForeignKeysByTable, ([table, foreignKeys]) => {
        const tableDiagnosis = this.diagnosesByTable.get(table);
        const config = configsByTable[table.name];

        const extraForeignKeys: ForeignKey['name'][] =
          tableDiagnosis && config
            ? R.intersection(
                tableDiagnosis.extraForeignKeys,
                tableDiagnosis.fixesForeignKeys(config),
              )
            : [];

        return table.dropForeignKeys(
          [...foreignKeys, ...extraForeignKeys],
          connection,
        );
      }),
    );

    await Promise.all(
      this.invalidTables.map(async (tableDiagnosis) => {
        const config = configsByTable[tableDiagnosis.table.name];
        if (config) {
          await tableDiagnosis.fix(config, connection);
        }
      }),
    );

    await Promise.all(
      Array.from(invalidForeignKeysByTable, ([table, foreignKeys]) => {
        const foreignKeySet = new Set(foreignKeys);

        const config = configsByTable[table.name];
        if (config && config.foreignKeys !== false) {
          if (
            this.missingTables.find((missingTable) => missingTable === table)
          ) {
            table.foreignKeys.forEach((foreignKey) =>
              foreignKeySet.add(foreignKey),
            );
          }

          const tableDiagnosis = this.diagnosesByTable.get(table);
          if (tableDiagnosis) {
            const fixableForeignKeys = tableDiagnosis.fixesForeignKeys(config);

            tableDiagnosis.missingForeignKeys.forEach((foreignKey) => {
              if (fixableForeignKeys.includes(foreignKey.name)) {
                foreignKeySet.add(foreignKey);
              }
            });
          }
        }

        return table.addForeignKeys([...foreignKeySet], connection);
      }),
    );
  }

  public async fix(
    config?: SchemaDiagnosisFixConfig,
    maybeConnection?: Connection,
  ): Promise<void> {
    return maybeConnection
      ? this.doFixWithConnection(config, maybeConnection)
      : this.schema.connector.withConnection(
          (connection) => this.doFixWithConnection(config, connection),
          StatementKind.DATA_DEFINITION,
        );
  }
}
