import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import assert from 'node:assert';
import { escapeIdentifier } from '../../escaping.js';
import type { MariaDBConnector } from '../../index.js';
import type { AbstractTableReference } from '../../statement/manipulation/clause/table-reference.js';
import type { WhereCondition } from '../../statement/manipulation/clause/where-condition.js';
import { ensureIdentifierName } from '../naming-strategy.js';
import type { Table } from '../table.js';
import type { ReferenceColumn } from './column/reference.js';
import type { PrimaryKey, UniqueIndex } from './index.js';

export * from './foreign-key/diagnosis.js';

export interface ForeignKeyIndexConfig {
  /**
   * Optional, the index's name
   */
  name?: utils.Nillable<string>;
}

/**
 * @see https://mariadb.com/kb/en/foreign-keys/
 */
export class ForeignKey {
  public readonly config?: ForeignKeyIndexConfig;
  public readonly configPath: utils.Path;

  public constructor(
    public readonly table: Table,
    public readonly edge: core.Edge<MariaDBConnector>,
  ) {
    // config
    {
      this.config = edge.config.foreignKey;
      this.configPath = utils.addPath(edge.configPath, 'foreignKey');

      utils.assertNillablePlainObject(this.config, this.configPath);
    }
  }

  @MGetter
  public get referencedTable(): Table {
    return this.table.schema.getTableByNode(this.edge.head);
  }

  @MGetter
  public get referencedIndex(): PrimaryKey | UniqueIndex {
    return this.referencedTable.primaryKey.uniqueConstraint ===
      this.edge.referencedUniqueConstraint
      ? this.referencedTable.primaryKey
      : this.referencedTable.getUniqueIndexByUniqueConstraint(
          this.edge.referencedUniqueConstraint,
        );
  }

  @MGetter
  public get columns(): ReadonlyArray<ReferenceColumn> {
    return this.table.getColumnTreeByEdge(this.edge).columns;
  }

  @MGetter
  public get name(): string {
    const nameConfig = this.config?.name;
    const nameConfigPath = utils.addPath(this.configPath, 'name');

    return nameConfig
      ? ensureIdentifierName(nameConfig, nameConfigPath)
      : this.table.schema.namingStrategy.getForeignKeyName(this);
  }

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @MGetter
  public get qualifiedName(): string {
    return `${this.table.name}.${this.name}`;
  }

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @MGetter
  public get fullyQualifiedName(): string {
    return `${this.table.qualifiedName}.${this.name}`;
  }

  @MMethod()
  public toString(): string {
    return this.fullyQualifiedName;
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#foreign-key
   */
  @MGetter
  public get definition(): string {
    return [
      'FOREIGN KEY',
      escapeIdentifier(this.name),
      `(${this.columns.map(({ name }) => escapeIdentifier(name)).join(',')})`,
      'REFERENCES',
      escapeIdentifier(this.referencedTable.name),
      `(${this.columns
        .map(({ referencedColumn: { name } }) => escapeIdentifier(name))
        .join(',')})`,
      'ON UPDATE RESTRICT',
      'ON DELETE RESTRICT',
    ]
      .filter(Boolean)
      .join(' ');
  }

  public getJoinConditions(
    tail: AbstractTableReference,
    head: AbstractTableReference,
  ): Array<WhereCondition> {
    assert.strictEqual(tail.table.node, this.edge.tail);
    assert.strictEqual(head.table.node, this.edge.head);

    return this.columns.map(
      (column) =>
        `${tail.escapeColumnIdentifier(column)} ${
          column.referencedColumn.isNullable() ? '<=>' : '='
        } ${head.escapeColumnIdentifier(column.referencedColumn)}`,
    );
  }
}
