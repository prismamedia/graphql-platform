import { CreateEventStatement, type PoolConnection } from '../index.js';
import type { Schema } from '../schema.js';
import { StatementKind } from '../statement.js';

export interface EventOptions {
  comment?: string;
}

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
    public readonly options?: EventOptions,
  ) {
    this.qualifiedName = `${this.schema}.${this.name}`;
  }

  public async create(
    connection?: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await this.schema.connector.withConnection(
      async (connection) => {
        await this.schema.connector.executeStatement(
          new CreateEventStatement(this, { orReplace: true }),
          connection,
        );

        await this.schema.connector.ensureEventSchedulerIsEnabled(connection);
      },
      StatementKind.DATA_DEFINITION,
      connection,
    );
  }
}
