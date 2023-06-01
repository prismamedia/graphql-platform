import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { MariaDBConnector, OkPacket } from './index.js';
import {
  SchemaDiagnosis,
  type SchemaDiagnosisOptions,
} from './schema/diagnosis.js';
import {
  SchemaNamingStrategy,
  ensureIdentifierName,
  type SchemaNamingStrategyConfig,
} from './schema/naming-strategy.js';
import {
  ColumnInformationsByColumnName,
  ForeignKeyInformationsByForeignKeyName,
  IndexInformationsByColumnNameByIndexName,
  Table,
} from './schema/table.js';
import {
  CreateSchemaStatement,
  CreateSchemaStatementConfig,
  DropSchemaStatement,
  DropSchemaStatementConfig,
  ForeignKeyInformation,
  GetColumnInformationStatement,
  GetForeignKeyInformationStatement,
  GetIndexInformationStatement,
  GetSchemaInformationStatement,
  GetTableInformationStatement,
  IndexInformation,
  type ColumnInformation,
  type SchemaInformation,
  type TableInformation,
} from './statement.js';

export * from './schema/diagnosis.js';
export * from './schema/naming-strategy.js';
export * from './schema/table.js';

export interface SchemaConfig {
  /**
   * Optional, the schema's name
   *
   * Default: the pool's database name
   */
  name?: utils.Nillable<string>;

  /**
   * Optional, the schema's default charset
   *
   * Default: the connector's charset
   */
  defaultCharset?: utils.Nillable<string>;

  /**
   * Optional, the schema's default collation
   *
   * Default: the connector's collation
   */
  defaultCollation?: utils.Nillable<string>;

  /**
   * Optional, customize how the resources are named
   */
  namingStrategy?: SchemaNamingStrategyConfig;

  /**
   * Optional, provide the default diagnosis's options
   */
  diagnosis?: SchemaDiagnosisOptions;
}

export class Schema {
  public readonly config?: SchemaConfig;
  public readonly configPath: utils.Path;

  public readonly name: string;
  public readonly comment?: string;
  public readonly namingStrategy: SchemaNamingStrategy;
  public readonly defaultCharset: string;
  public readonly defaultCollation: string;
  public readonly tablesByNode: ReadonlyMap<core.Node, Table>;
  public readonly tables: ReadonlyArray<Table>;

  public constructor(public readonly connector: MariaDBConnector) {
    // config
    {
      this.config = connector.config?.schema;
      this.configPath = utils.addPath(connector.configPath, 'schema');

      utils.assertNillablePlainObject(this.config, this.configPath);
    }

    // name
    {
      const databasePoolConfig = connector.poolConfig?.database;
      const databasePoolConfigPath = utils.addPath(
        connector.poolConfigPath,
        'database',
      );

      const nameConfig = this.config?.name;
      const nameConfigPath = utils.addPath(this.configPath, 'name');

      if (databasePoolConfig) {
        if (nameConfig) {
          throw new utils.UnexpectedValueError(
            `not to be provided as the database is selected`,
            nameConfig,
            { path: nameConfigPath },
          );
        }

        this.name = ensureIdentifierName(
          databasePoolConfig,
          databasePoolConfigPath,
        );
      } else {
        this.name = ensureIdentifierName(nameConfig, nameConfigPath);
      }
    }

    // naming-strategy
    {
      this.namingStrategy = new SchemaNamingStrategy(
        this.config?.namingStrategy,
        utils.addPath(this.configPath, 'namingStrategy'),
      );
    }

    // default-charset
    {
      this.defaultCharset = this.config?.defaultCharset ?? connector.charset;
    }

    // default-collation
    {
      this.defaultCollation =
        this.config?.defaultCollation ?? connector.collation;
    }

    // tables-by-node
    {
      this.tablesByNode = new Map(
        Array.from(connector.gp.nodesByName.values(), (node) => [
          node,
          new Table(this, node),
        ]),
      );

      this.tables = Array.from(this.tablesByNode.values());
    }
  }

  public toString(): string {
    return this.name;
  }

  public getTableByNode(nodeOrName: core.Node | core.Node['name']): Table {
    const node = this.connector.gp.ensureNode(nodeOrName);
    const table = this.tablesByNode.get(node);
    assert(table, `No table found for the node "${node}"`);

    return table;
  }

  public async drop(
    config?: DropSchemaStatementConfig,
    maybeConnection?: mariadb.Connection,
  ): Promise<void> {
    await this.connector.executeStatement<OkPacket>(
      new DropSchemaStatement(this, config),
      maybeConnection,
    );
  }

  public async create(
    config?: CreateSchemaStatementConfig,
    maybeConnection?: mariadb.Connection,
  ): Promise<void> {
    await this.connector.executeStatement<OkPacket>(
      new CreateSchemaStatement(this, config),
      maybeConnection,
    );
  }

  public async diagnose(
    options: SchemaDiagnosisOptions | undefined = this.config?.diagnosis,
  ): Promise<SchemaDiagnosis> {
    const [
      schemaInformations,
      tableInformations,
      columnInformations,
      indexInformations,
      foreignKeyInformations,
    ] = await Promise.all([
      this.connector.executeStatement<SchemaInformation[]>(
        new GetSchemaInformationStatement(this),
      ),
      this.connector.executeStatement<TableInformation[]>(
        new GetTableInformationStatement(this),
      ),
      this.connector.executeStatement<ColumnInformation[]>(
        new GetColumnInformationStatement(this),
      ),
      this.connector.executeStatement<IndexInformation[]>(
        new GetIndexInformationStatement(this),
      ),
      this.connector.executeStatement<ForeignKeyInformation[]>(
        new GetForeignKeyInformationStatement(this),
      ),
    ]);

    assert(schemaInformations.length, `The schema "${this}" is missing`);
    const schemaInformation = schemaInformations[0];

    const tableInformationsByTableName = new Map<
      Table['name'],
      TableInformation
    >(
      tableInformations.map((information) => [
        information.TABLE_NAME,
        information,
      ]),
    );

    const columnInformationsByColumnNameByTableName = new Map<
      Table['name'],
      ColumnInformationsByColumnName
    >();

    for (const columnInformation of columnInformations) {
      let columnInformationsByColumnName =
        columnInformationsByColumnNameByTableName.get(
          columnInformation.TABLE_NAME,
        );

      if (!columnInformationsByColumnName) {
        columnInformationsByColumnNameByTableName.set(
          columnInformation.TABLE_NAME,
          (columnInformationsByColumnName = new Map()),
        );
      }

      columnInformationsByColumnName.set(
        columnInformation.COLUMN_NAME,
        columnInformation,
      );
    }

    const indexInformationsByColumnNameByIndexNameByTableName = new Map<
      Table['name'],
      IndexInformationsByColumnNameByIndexName
    >();

    for (const indexInformation of indexInformations) {
      let indexInformationsByColumnNameByIndexName =
        indexInformationsByColumnNameByIndexNameByTableName.get(
          indexInformation.TABLE_NAME,
        );

      if (!indexInformationsByColumnNameByIndexName) {
        indexInformationsByColumnNameByIndexNameByTableName.set(
          indexInformation.TABLE_NAME,
          (indexInformationsByColumnNameByIndexName = new Map()),
        );
      }

      let indexInformationsByColumnName =
        indexInformationsByColumnNameByIndexName.get(
          indexInformation.INDEX_NAME,
        );

      if (!indexInformationsByColumnName) {
        indexInformationsByColumnNameByIndexName.set(
          indexInformation.INDEX_NAME,
          (indexInformationsByColumnName = new Map()),
        );
      }

      indexInformationsByColumnName.set(
        indexInformation.COLUMN_NAME,
        indexInformation,
      );
    }

    const foreignKeyInformationsByForeignKeyNameByTableName = new Map<
      Table['name'],
      ForeignKeyInformationsByForeignKeyName
    >();

    for (const foreignKeyInformation of foreignKeyInformations) {
      let foreignKeyInformationsByForeignKeyName =
        foreignKeyInformationsByForeignKeyNameByTableName.get(
          foreignKeyInformation.TABLE_NAME,
        );

      if (!foreignKeyInformationsByForeignKeyName) {
        foreignKeyInformationsByForeignKeyNameByTableName.set(
          foreignKeyInformation.TABLE_NAME,
          (foreignKeyInformationsByForeignKeyName = new Map()),
        );
      }

      foreignKeyInformationsByForeignKeyName.set(
        foreignKeyInformation.CONSTRAINT_NAME,
        foreignKeyInformation,
      );
    }

    return new SchemaDiagnosis(
      this,
      {
        schema: schemaInformation,
        tables: tableInformationsByTableName,
        columns: columnInformationsByColumnNameByTableName,
        indexes: indexInformationsByColumnNameByIndexNameByTableName,
        foreignKeys: foreignKeyInformationsByForeignKeyNameByTableName,
      },
      options,
    );
  }
}
