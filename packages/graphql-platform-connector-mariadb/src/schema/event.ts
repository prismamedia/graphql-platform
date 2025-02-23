import { CreateEventStatement, type PoolConnection } from '../index.js';
import type { Schema } from '../schema.js';
import type { CreateEventStatementConfig } from '../statement.js';

/**
 * @see https://mariadb.com/kb/en/events/
 */
export class Event {
  public readonly qualifiedName: string;

  public constructor(
    public readonly schema: Schema,
    public readonly name: string,
    public readonly schedule: string,
    public readonly statement: string,
  ) {
    this.qualifiedName = `${this.schema}.${this.name}`;
  }

  public async create(
    config?: CreateEventStatementConfig,
    connection?: PoolConnection,
  ): Promise<void> {
    await this.schema.connector.executeStatement(
      new CreateEventStatement(this, config),
      connection,
    );
  }
}
