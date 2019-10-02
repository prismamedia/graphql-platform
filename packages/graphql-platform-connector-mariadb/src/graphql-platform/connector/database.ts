import { Resource } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import marvDriver from 'marv-mysql-driver';
import marv from 'marv/api/promise';
import * as mysql from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Connector, MigrationsFullOptions, MigrationsOptions } from '../connector';
import { CreateTableStatement } from './database/statement';
import { Table, TableSet } from './database/table';

export * from './database/statement';
export * from './database/table';

export class Database {
  public constructor(readonly connector: Connector) {}

  @Memoize()
  public get name(): string {
    const name = this.connector.getPoolConfig().connectionConfig.database;
    if (!name) {
      throw new Error(`The database's name has to be defined`);
    }

    return name;
  }

  @Memoize(({ name }: Resource) => name)
  public getTable(resource: Resource): Table {
    return new Table(this, resource);
  }

  @Memoize()
  public getTableSet(): TableSet {
    return new TableSet(
      this.connector.gp
        .getResourceGraph()
        .overallOrder()
        .map(resourceName => this.getTable(this.connector.gp.getResourceMap().assert(resourceName))),
    );
  }

  public async create(connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.connector.query([...this.getTableSet()].map(table => new CreateTableStatement(table).sql), connection);
  }

  public async truncate(connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.connector.query(
      [
        'SET FOREIGN_KEY_CHECKS = 0;',
        ...[...this.getTableSet()].map(table => `TRUNCATE TABLE ${table.getEscapedName()};`),
        'SET FOREIGN_KEY_CHECKS = 1;',
      ],
      connection,
    );
  }

  public async drop(all: boolean = false, connection?: Maybe<mysql.Connection>): Promise<void> {
    try {
      await this.connector.query(
        [
          'SET FOREIGN_KEY_CHECKS = 0;',
          ...(all
            ? [
                `SET @tables = NULL`,
                `SELECT GROUP_CONCAT(table_schema, '.', table_name) INTO @tables
                  FROM information_schema.tables
                  WHERE table_schema = '${this.name}'`,
                `SET @views = CONCAT('DROP VIEW IF EXISTS ', @tables);`,
                `PREPARE stmt FROM @views`,
                `EXECUTE stmt`,
                `DEALLOCATE PREPARE stmt`,
                `SET @tables = CONCAT('DROP TABLE IF EXISTS ', @tables);`,
                `PREPARE stmt FROM @tables`,
                `EXECUTE stmt`,
                `DEALLOCATE PREPARE stmt`,
              ]
            : [`DROP TABLE IF EXISTS ${[...this.getTableSet()].map(table => table.getEscapedName()).join(', ')};`]),
          'SET FOREIGN_KEY_CHECKS = 1;',
        ],
        connection,
      );
    } catch (error) {
      if (all && ['PREPARE stmt FROM @views', 'PREPARE stmt FROM @tables'].includes(error.sql)) {
        // Do nothing, the database is already empty
      } else {
        throw error;
      }
    }
  }

  public async reset(all: boolean = false, connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.drop(all, connection);
    await this.create(connection);
  }

  public async migrate(options?: Maybe<MigrationsOptions>): Promise<void> {
    const actualOptions = options || (this.connector.config && this.connector.config.migrations);
    if (!actualOptions) {
      throw new Error(`You have to provide the connector's configuration.`);
    }

    const { directory, tableName }: MigrationsFullOptions =
      typeof actualOptions === 'string' ? { directory: actualOptions } : actualOptions;

    const migrations = await marv.scan(directory);

    await marv.migrate(
      migrations,
      marvDriver({
        connection: { ...this.connector.getPoolConfig().connectionConfig, multipleStatements: true },
        table: tableName || 'migrations',
      }),
    );
  }
}
