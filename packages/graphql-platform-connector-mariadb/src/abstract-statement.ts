import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import type { MariaDBConnector } from './index.js';

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

  public constructor(protected readonly connector: MariaDBConnector) {}

  public async execute(
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<TResult> {
    return maybeConnection
      ? maybeConnection.query(this.statement)
      : this.connector.withConnection((connection) =>
          connection.query(this.statement),
        );
  }
}
