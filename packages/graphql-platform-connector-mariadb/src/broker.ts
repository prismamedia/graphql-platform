import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { escapeIdentifier, escapeStringValue } from './escaping.js';
import type { MariaDBConnector, OkPacket } from './index.js';

export interface BrokerOptions {
  requestsTable?: string;
  changesByRequestTable?: string;
}

export class Broker implements core.BrokerInterface {
  readonly #requestsTable: string;
  readonly #changesByRequestTable: string;

  public constructor(
    public readonly connector: MariaDBConnector,
    options?: BrokerOptions,
  ) {
    this.#requestsTable = options?.requestsTable ?? '_gp_requests';
    this.#changesByRequestTable =
      options?.changesByRequestTable ?? '_gp_changes_by_request';
  }

  public async setup(connection?: mariadb.Connection): Promise<void> {
    const createRequestsTable = `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.#requestsTable}`)} (
      ${escapeIdentifier('id')} BIGINT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY,
      ${escapeIdentifier('request')} JSON NOT NULL,
      ${escapeIdentifier('at')} TIMESTAMP NOT NULL
    )`;

    await (connection
      ? connection.query(createRequestsTable)
      : this.connector.executeQuery(createRequestsTable));

    const createChangesByRequestTable = `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.#changesByRequestTable}`)} (
        ${escapeIdentifier('requestId')} BIGINT UNSIGNED NOT NULL,
        ${escapeIdentifier('id')} BIGINT UNSIGNED NOT NULL,
        ${escapeIdentifier('node')} VARCHAR(255) NOT NULL,
        ${escapeIdentifier('kind')} ENUM(${utils.mutationTypes.map(escapeStringValue).join(',')}) NOT NULL,
        ${escapeIdentifier('oldValue')} JSON NULL,
        ${escapeIdentifier('newValue')} JSON NULL,
        ${escapeIdentifier('at')} TIMESTAMP NOT NULL,
        PRIMARY KEY (${escapeIdentifier('requestId')}, ${escapeIdentifier('id')})
    )`;

    await (connection
      ? connection.query(createChangesByRequestTable)
      : this.connector.executeQuery(createChangesByRequestTable));
  }

  public async publish(changes: core.MutationContextChanges): Promise<void> {
    await using connection = await this.connector.getConnection();

    const insertRequest = await connection.execute<OkPacket>(
      `INSERT INTO ${escapeIdentifier(this.#requestsTable)} (${['request', 'at'].map(escapeIdentifier).join(',')}) VALUES (?, ?)`,
      [JSON.stringify(changes.requestContext), changes.at],
    );

    console.debug('PRE-INSERT', changes.size);

    const insertChanges = await connection.batch(
      `INSERT INTO ${escapeIdentifier(this.#changesByRequestTable)} VALUES (?, ?, ?, ?, ?, ?, ?)`,
      Array.from(changes, (change, id) => [
        insertRequest.insertId,
        id + 1,
        change.node.name,
        change.kind,
        null,
        null,
        change.at,
      ]),
    );

    console.debug(insertChanges);
  }

  public async subscribe(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<core.NodeChangeSubscriptionInterface> {
    return {
      [Symbol.asyncIterator]: async function* () {},
      [Symbol.asyncDispose]: async () => {},
    };
  }

  public async onIdle(
    subscription: core.ChangesSubscriptionStream,
    callback: () => void,
  ): Promise<void> {}
}
