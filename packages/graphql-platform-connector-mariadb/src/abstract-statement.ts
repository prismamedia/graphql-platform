import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type * as mariadb from 'mariadb';
import { hrtime } from 'node:process';
import type { MariaDBConnector } from './index.js';
import type { Statement } from './statement.js';

/**
 * @see https://mariadb.com/kb/en/ok_packet/
 */
export type OkPacket = {
  affectedRows: number;
  insertId: BigInt;
  warningStatus: number;
};

export abstract class AbstractStatement<TResult = unknown> {
  public abstract readonly statement: string | mariadb.QueryOptions;

  public constructor(public readonly connector: MariaDBConnector) {}

  @Memoize()
  public get sql(): string {
    return typeof this.statement === 'string'
      ? this.statement
      : this.statement.sql;
  }

  public async execute(
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<TResult> {
    const startedAt = hrtime.bigint();

    const result = await (maybeConnection
      ? maybeConnection.query(this.statement)
      : this.connector.withConnection((connection) =>
          connection.query(this.statement),
        ));

    this.connector.executedStatements.next({
      statement: this as Statement,
      result,
      sql: this.sql,
      took: Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) / 10 ** 3,
    });

    return result;
  }
}
