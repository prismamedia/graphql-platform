import * as core from '@prismamedia/graphql-platform';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert/strict';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../../escape.js';
import { AbstractTableReference } from '../abstract-table-reference.js';
import type { TableReference } from '../table-reference.js';

export enum JoinTableKind {
  LEFT,
  INNER,
}

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class JoinTable extends AbstractTableReference {
  public override readonly alias: string;
  public override readonly depth: number;

  public constructor(
    public readonly parent: TableReference,
    public readonly edge: core.Edge | core.ReverseEdge,
    /**
     * An optional key used to discriminate 2 joins, imagine the following "selection":
     *
     * articles {
     *  firstTags: tags(orderBy: [order_ASC], first: 5) { title }
     *  lastTags: tags(orderBy: [order_DESC], first: 5) { title }
     * }
     *
     * We need 2 joins on "tags", and we'll discriminate them using the keys "firstTags" and "lastTags"
     */
    key?: string,
  ) {
    assert.equal(edge.tail, parent.table.node);

    const head = parent.table.schema.getTableByNode(edge.head);
    super(head);

    this.alias = `${parent.alias}>${key || head.name}`;
    this.depth = parent.depth + 1;
  }

  public get kind(): JoinTableKind {
    return this.edge.isNullable() ? JoinTableKind.LEFT : JoinTableKind.INNER;
  }

  @Memoize()
  public get condition(): string {
    return (
      this.edge instanceof core.Edge
        ? this.parent.table
            .getForeignKeyByEdge(this.edge)
            .columns.map(
              (column) =>
                `${escapeIdentifier(
                  `${this.parent.alias}.${column.name}`,
                )} = ${escapeIdentifier(
                  `${this.alias}.${column.referencedColumn.name}`,
                )}`,
            )
        : this.table
            .getForeignKeyByEdge(this.edge.originalEdge)
            .columns.map(
              (column) =>
                `${escapeIdentifier(
                  `${this.parent.alias}.${column.referencedColumn.name}`,
                )} = ${escapeIdentifier(`${this.alias}.${column.name}`)}`,
            )
    ).join(' AND ');
  }

  public override toString(): string {
    return [
      `${JoinTableKind[this.kind]} JOIN ${escapeIdentifier(
        this.tableIdentifier,
      )} AS ${escapeIdentifier(this.alias)} ON ${this.condition}`,
      ...Array.from(this.children.values(), (joinTable) =>
        joinTable.toIndentedString(),
      ),
    ].join(EOL);
  }

  public toIndentedString(indentation: string = '  '): string {
    return this.toString()
      .split(EOL)
      .map((line) => `${indentation}${line}`)
      .join(EOL);
  }
}
