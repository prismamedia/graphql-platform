import { Resource } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import * as mysql from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Connector } from '../connector';
import { CreateTableStatement } from './database/statement';
import { Table, TableSet } from './database/table';

export * from './database/table';

export class Database {
  public constructor(readonly connector: Connector) {}

  @Memoize(({ name }: Resource) => name)
  public getTable(resource: Resource): Table {
    return new Table(this, resource);
  }

  @Memoize()
  public getTableSet(): TableSet {
    return new TableSet(
      this.connector.graphqlPlatform
        .getResourceGraph()
        .overallOrder()
        .map(resourceName => this.getTable(this.connector.graphqlPlatform.getResourceMap().assert(resourceName))),
    );
  }

  public async create(connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.connector.querySerial(
      [...this.getTableSet()].map(table => new CreateTableStatement(table).sql),
      connection,
    );
  }

  public async truncate(connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.connector.querySerial(
      [
        'SET FOREIGN_KEY_CHECKS = 0;',
        ...[...this.getTableSet()].map(table => `TRUNCATE TABLE ${table.getEscapedName()};`),
        'SET FOREIGN_KEY_CHECKS = 1;',
      ],
      connection,
    );
  }

  public async drop(connection?: Maybe<mysql.Connection>): Promise<void> {
    await this.connector.querySerial(
      [
        'SET FOREIGN_KEY_CHECKS = 0;',
        `DROP TABLE IF EXISTS ${[...this.getTableSet()].map(table => table.getEscapedName()).join(', ')};`,
        'SET FOREIGN_KEY_CHECKS = 1;',
      ],
      connection,
    );
  }
}
