import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { AbstractStatement } from '../abstract-statement.js';
import { escapeIdentifier } from '../escape.js';
import { LeafColumn, ReferenceColumn, Table } from '../schema.js';

export interface InsertStatementConfig {
  lowPriority?: boolean;
  delayed?: boolean;
  highPriority?: boolean;
  ignore?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/insertreturning/
 */
export class InsertStatement<
  TRow extends utils.PlainObject,
> extends AbstractStatement<TRow[]> {
  protected readonly creations: ReadonlyArray<core.NodeCreation>;

  public constructor(
    protected readonly table: Table,
    { creations }: core.ConnectorCreateStatement,
    protected readonly config?: InsertStatementConfig,
  ) {
    super(table.schema.connector);

    this.creations = creations;
  }

  protected serializeLeafColumnValue(
    creation: core.NodeCreation,
    column: LeafColumn,
  ): string {
    const leafValue = creation.valuesByLeaf.get(column.leaf) ?? null;
    const columnValue = column.dataType.toColumnValue(leafValue);

    if (!column.isNullable() && !column.isAutoIncrement()) {
      assert.notEqual(
        columnValue,
        null,
        `The column "${column}" is not nullable`,
      );
    }

    return column.dataType.serialize(columnValue as any);
  }

  protected serializeReferenceColumnValue(
    creation: core.NodeCreation,
    column: ReferenceColumn,
  ): string {
    const edgeValue = creation.valuesByEdge.get(column.edge) ?? null;
    const leafValue = column.pickLeafValueFromEdgeValue(edgeValue);
    const columnValue = column.dataType.toColumnValue(leafValue);

    if (!column.isNullable()) {
      assert.notEqual(
        columnValue,
        null,
        `The column "${column}" is not nullable`,
      );
    }

    return column.dataType.serialize(columnValue as any);
  }

  protected serializeColumnValues(creation: core.NodeCreation): string[] {
    return this.table.columns.flatMap((column) =>
      column instanceof LeafColumn
        ? this.serializeLeafColumnValue(creation, column)
        : this.serializeReferenceColumnValue(creation, column),
    );
  }

  @Memoize()
  public override get statement(): string {
    return [
      [
        'INSERT',
        this.config?.lowPriority
          ? 'LOW_PRIORITY'
          : this.config?.delayed
          ? 'DELAYED'
          : this.config?.highPriority
          ? 'HIGH_PRIORITY'
          : undefined,
        this.config?.ignore && 'IGNORE',
        `INTO ${escapeIdentifier(this.table.qualifiedName)}`,
      ]
        .filter(Boolean)
        .join(' '),
      `  (${this.table.columns
        .map(({ name }) => escapeIdentifier(name))
        .join(',')})`,
      'VALUES',
      this.creations
        .map(
          (creation) => `  (${this.serializeColumnValues(creation).join(',')})`,
        )
        .join(`,${EOL}`),
      `RETURNING`,
      `  ${this.table.columns
        .map(({ name }) => escapeIdentifier(name))
        .join(',')}`,
    ].join(EOL);
  }
}
