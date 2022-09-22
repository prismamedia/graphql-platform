import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import type { MariaDBConnector } from './index.js';
import { Table } from './schema/table.js';
import {
  CreateSchemaStatement,
  CreateSchemaStatementConfig,
  DropSchemaStatement,
  DropSchemaStatementConfig,
} from './statement.js';

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
}

export class Schema {
  public readonly config: SchemaConfig | undefined;
  public readonly configPath: utils.Path;

  public readonly name: string;
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
      const name = this.config?.name || connector.config.pool?.database;
      if (typeof name !== 'string' || !name) {
        throw new utils.UnexpectedConfigError(`a non-empty string`, name, {
          path: utils.addPath(this.configPath, 'name'),
        });
      }

      this.name = name;
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

  public makeDropStatement(
    config?: DropSchemaStatementConfig,
  ): DropSchemaStatement {
    return new DropSchemaStatement(this, config);
  }

  public async drop(
    config?: DropSchemaStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<void> {
    await this.makeDropStatement(config).execute(maybeConnection);
  }

  public makeCreateStatement(
    config?: CreateSchemaStatementConfig,
  ): CreateSchemaStatement {
    return new CreateSchemaStatement(this, config);
  }

  public async create(
    config?: CreateSchemaStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<void> {
    await this.makeCreateStatement(config).execute(maybeConnection);
  }
}
