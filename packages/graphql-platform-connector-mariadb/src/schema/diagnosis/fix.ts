import * as utils from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import * as R from 'remeda';
import { escapeIdentifier } from '../../escaping.js';
import type { OkPacket } from '../../index.js';
import type { ForeignKey, Schema, SchemaDiagnosis } from '../../schema.js';
import { FixSchemaStatement } from '../../statement.js';
import {
  InvalidTableFix,
  MissingTableFix,
  Table,
  TableDiagnosis,
  type InvalidTableFixOptions,
  type TableFix,
} from '../table.js';

export type SchemaFixOptions = {
  ignore?: boolean;

  charset?: boolean;
  collation?: boolean;
  comment?: boolean;
  engine?: boolean;

  foreignKeys?: boolean;
  indexes?: boolean;

  nullable?: boolean;
  columns?: boolean;

  tables?:
    | boolean
    | ReadonlyArray<Table['name']>
    | Record<Table['name'], boolean | InvalidTableFixOptions>;
};

export class SchemaFix {
  public readonly schema: Schema;

  public readonly comment: boolean;
  public readonly charset: boolean;
  public readonly collation: boolean;

  public readonly extraTables: ReadonlyArray<Table['name']>;
  public readonly untouchedExtraTables: ReadonlyArray<Table['name']>;

  public readonly missingTableFixes: ReadonlyArray<MissingTableFix>;
  public readonly untouchedMissingTables: ReadonlyArray<Table>;

  public readonly invalidTableFixes: ReadonlyArray<InvalidTableFix>;
  public readonly untouchedInvalidTables: ReadonlyArray<TableDiagnosis>;

  public readonly tableFixes: ReadonlyArray<TableFix>;

  public readonly validForeignKeysReferencingInvalidColumnsByTable: ReadonlyMap<
    Table,
    ReadonlyArray<ForeignKey>
  >;

  public readonly tableFixGraph: DepGraph<TableFix>;

  public constructor(
    public readonly diagnosis: SchemaDiagnosis,
    options?: SchemaFixOptions,
  ) {
    this.schema = diagnosis.schema;

    this.comment = Boolean(
      diagnosis.commentError && utils.getOptionalFlag(options?.comment, true),
    );

    this.charset = Boolean(
      diagnosis.charsetError && utils.getOptionalFlag(options?.charset, true),
    );

    this.collation = Boolean(
      diagnosis.collationError &&
        utils.getOptionalFlag(options?.collation, true),
    );

    // tables
    {
      const defaults: InvalidTableFixOptions = {
        ignore: options?.ignore,
        collation: options?.collation,
        comment: options?.comment,
        engine: options?.engine,
        nullable: options?.nullable,
        foreignKeys: options?.foreignKeys,
        indexes: options?.indexes,
        columns: options?.columns,
      };

      const configsByTable = Object.fromEntries<InvalidTableFixOptions>(
        R.intersectionWith(
          options?.tables == null || options.tables === true
            ? diagnosis.fixableTableNames.map((name) => [name, defaults])
            : options.tables === false
              ? []
              : Array.isArray(options.tables)
                ? options.tables.map((name) => [name, defaults])
                : Object.entries(options.tables)
                    .filter(
                      (
                        entry,
                      ): entry is [string, true | InvalidTableFixOptions] =>
                        entry[1] !== false,
                    )
                    .map(([name, options]) => [
                      name,
                      options === true ? defaults : { ...defaults, ...options },
                    ]),
          diagnosis.fixableTableNames,
          ([a], b) => a === b,
        ),
      );

      this.extraTables = R.intersection(
        diagnosis.extraTables,
        Object.keys(configsByTable),
      );

      this.untouchedExtraTables = R.difference(
        diagnosis.extraTables,
        this.extraTables,
      );

      this.missingTableFixes = R.pipe(
        diagnosis.missingTables,
        R.intersectionWith(Object.keys(configsByTable), (a, b) => a.name === b),
        R.map((table) => new MissingTableFix(this, table)),
      );

      this.untouchedMissingTables = R.difference(
        diagnosis.missingTables,
        this.missingTableFixes.map(({ table }) => table),
      );

      this.invalidTableFixes = R.pipe(
        diagnosis.invalidTables,
        R.intersectionWith(
          Object.keys(configsByTable),
          (a, b) => a.table.name === b,
        ),
        R.map(
          (diagnosis) =>
            new InvalidTableFix(
              this,
              diagnosis,
              configsByTable[diagnosis.table.name],
            ),
        ),
      );

      this.untouchedInvalidTables = R.difference(
        diagnosis.invalidTables,
        this.invalidTableFixes.map(({ diagnosis }) => diagnosis),
      );

      this.tableFixes = [...this.missingTableFixes, ...this.invalidTableFixes];
    }

    this.validForeignKeysReferencingInvalidColumnsByTable = new Map(
      R.pipe(
        this.schema.tables,
        // Don't care about the missing tables
        R.difference(diagnosis.missingTables),
        R.map((table): [Table, ForeignKey[]] => [
          table,
          R.pipe(
            table.foreignKeys,
            // Don't care about the missing foreign-keys
            R.difference(
              diagnosis.invalidTables.find(
                (invalidTable) => invalidTable.table === table,
              )?.missingForeignKeys ?? [],
            ),
            R.intersectionWith(
              this.invalidTableFixes,
              (a, b) =>
                a.referencedIndex.table === b.table &&
                R.intersectionWith(
                  a.referencedIndex.columns,
                  b.invalidColumns,
                  (a, b) => a === b.column,
                ).length > 0,
            ),
          ),
        ]),
        R.filter(([, foreignKeys]) => foreignKeys.length > 0),
      ),
    );

    // table-fix-graph
    {
      this.tableFixGraph = new DepGraph({ circular: false });

      this.tableFixes.forEach((fix) =>
        this.tableFixGraph.addNode(fix.table.name, fix),
      );

      this.tableFixes.forEach((fix) =>
        fix.missingForeignKeyDependencies.forEach((dependency) =>
          this.tableFixGraph.addDependency(
            fix.table.name,
            dependency.table.name,
          ),
        ),
      );
    }
  }

  public async execute(): Promise<void> {
    const connector = this.schema.connector;

    if (FixSchemaStatement.supports(this)) {
      await connector.executeStatement(new FixSchemaStatement(this));
    }

    await Promise.all(
      Array.from(
        this.validForeignKeysReferencingInvalidColumnsByTable,
        ([table, foreignKeys]) => table.dropForeignKeys(foreignKeys),
      ),
    );

    const fixes: Record<
      Table['name'],
      Promise<OkPacket | void>
    > = Object.fromEntries(
      this.extraTables.map((tableName) => [
        tableName,
        connector.executeQuery<OkPacket>(
          `DROP TABLE ${escapeIdentifier(`${this.schema}.${tableName}`)}`,
        ),
      ]),
    );

    this.tableFixGraph.overallOrder().forEach(
      (tableName) =>
        (fixes[tableName] = new Promise(async (resolve, reject) => {
          try {
            await Promise.all(
              this.tableFixGraph
                .dependenciesOf(tableName)
                .map((dependency) => fixes[dependency]),
            );

            await this.tableFixGraph.getNodeData(tableName).execute();

            resolve();
          } catch (error) {
            reject(error);
          }
        })),
    );

    await Promise.all(Object.values(fixes));

    await Promise.all(
      Array.from(
        this.validForeignKeysReferencingInvalidColumnsByTable,
        ([table, foreignKeys]) => table.addForeignKeys(foreignKeys),
      ),
    );
  }
}
