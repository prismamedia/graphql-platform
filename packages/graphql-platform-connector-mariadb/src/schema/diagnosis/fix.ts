import * as utils from '@prismamedia/graphql-platform-utils';
import { DepGraph } from 'dependency-graph';
import * as R from 'remeda';
import { escapeIdentifier } from '../../escaping.js';
import type { OkPacket } from '../../index.js';
import type { Schema, SchemaDiagnosis, Table } from '../../schema.js';
import { FixSchemaStatement, StatementKind } from '../../statement.js';
import {
  InvalidTableFix,
  MissingTableFix,
  ValidOrUntouchedInvalidTableFix,
  type InvalidTableFixOptions,
  type TableDiagnosis,
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

  public readonly validOrUntouchedInvalidTableFixes: ReadonlyArray<ValidOrUntouchedInvalidTableFix>;

  public readonly tableFixes: ReadonlyArray<TableFix>;

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

      this.validOrUntouchedInvalidTableFixes = R.pipe(
        this.schema.tables,
        R.difference(diagnosis.missingTables),
        R.differenceWith(this.invalidTableFixes, (a, b) => a === b.table),
        R.map(
          (table) =>
            new ValidOrUntouchedInvalidTableFix(
              this,
              table,
              diagnosis.invalidTables.find(
                (invalidTable) => invalidTable.table === table,
              ),
            ),
        ),
      );

      this.tableFixes = [
        ...this.missingTableFixes,
        ...this.invalidTableFixes,
        ...this.validOrUntouchedInvalidTableFixes,
      ];
    }

    // table-fix-graph
    {
      this.tableFixGraph = new DepGraph({ circular: false });

      this.tableFixes.forEach((fix) =>
        this.tableFixGraph.addNode(fix.table.name, fix),
      );

      this.tableFixes.forEach((fix) =>
        fix.dependencies.forEach((dependency) =>
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

    await using connection = await connector.getConnection(
      StatementKind.DATA_DEFINITION,
    );

    await connection.query(`SET max_statement_time=${60 * 60 * 24};`);

    for (const tableName of this.extraTables) {
      await connection.query<OkPacket>(
        `DROP TABLE ${escapeIdentifier(`${this.schema}.${tableName}`)}`,
      );
    }

    if (FixSchemaStatement.supports(this)) {
      await connector.executeStatement(
        new FixSchemaStatement(this),
        connection,
      );
    }

    for (const fix of this.tableFixes) {
      await fix.prepare(connection);
    }

    for (const tableName of this.tableFixGraph.overallOrder()) {
      await this.tableFixGraph.getNodeData(tableName).execute(connection);
    }

    for (const fix of this.tableFixes) {
      await fix.finalize(connection);
    }
  }
}
