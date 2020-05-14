import { Resource } from '@prismamedia/graphql-platform-core';
import { POJO } from '@prismamedia/graphql-platform-utils';
import { Connector } from '../../connector';
import { Database } from '../database';
import { OperationResolverParams } from './operation';
import { Table } from './table';

export abstract class AbstractOperationResolver<TArgs extends POJO, TResult> {
  readonly resource: Resource<any>;
  readonly database: Database;
  readonly connector: Connector;

  public constructor(readonly table: Table) {
    this.resource = table.resource;
    this.database = table.database;
    this.connector = table.database.connector;
  }

  public abstract async execute(
    params: OperationResolverParams<TArgs>,
  ): Promise<TResult>;
}
