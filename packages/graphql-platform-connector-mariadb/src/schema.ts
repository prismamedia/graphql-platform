import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import type { MariaDBConnector, OkPacket } from './index.js';
import {
  SchemaNamingStrategy,
  type SchemaNamingStrategyConfig,
} from './schema/naming-strategy.js';
import { Table } from './schema/table.js';
import {
  CreateSchemaStatement,
  CreateSchemaStatementConfig,
  DropSchemaStatement,
  DropSchemaStatementConfig,
} from './statement.js';

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
}

export class Schema {
  public readonly config?: SchemaConfig;
  public readonly configPath: utils.Path;

  public readonly name: string;
  public readonly namingStrategy: SchemaNamingStrategy;
  public readonly defaultCharset: string;
  public readonly defaultCollation: string;
  public readonly tablesByNode: ReadonlyMap<core.Node, Table>;

  public constructor(public readonly connector: MariaDBConnector) {
    // config
    {
      this.config = connector.config?.schema;
      this.configPath = utils.addPath(connector.configPath, 'schema');

      utils.assertNillablePlainObjectConfig(this.config, this.configPath);
    }

    // name
    {
      const nameConfig = this.config?.name || undefined;
      const nameConfigPath = utils.addPath(this.configPath, 'name');

      if (connector.databasePoolConfig !== undefined) {
        if (nameConfig !== undefined) {
          throw new utils.UnexpectedConfigError(
            `not to be defined as the database is selected`,
            nameConfig,
            { path: nameConfigPath },
          );
        }

        this.name = connector.databasePoolConfig;
      } else {
        if (nameConfig === undefined) {
          throw new utils.UnexpectedConfigError(
            `a non-empty string`,
            nameConfig,
            { path: nameConfigPath },
          );
        }

        this.name = nameConfig;
      }
    }

    // naming-strategy
    {
      this.namingStrategy = new SchemaNamingStrategy(
        this.config?.namingStrategy,
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
        connector.gp.nodes.map((node) => [node, new Table(this, node)]),
      );
    }
  }

  public toString(): string {
    return this.name;
  }

  public getTableByNode(node: core.Node): Table {
    const table = this.tablesByNode.get(node);
    assert(table, `The node "${node}" does not exist`);

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
}
