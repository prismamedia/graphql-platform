import * as core from '@prismamedia/graphql-platform';
import { Memoize } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../../escaping.js';
import { AbstractTableReference } from '../abstract-table-reference.js';
import type { TableReference } from '../table-reference.js';
import { filterNode } from '../where-condition.js';

export enum JoinTableKind {
  LEFT,
  INNER,
}

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class JoinTable extends AbstractTableReference {
  protected readonly authorization?: core.NodeFilter;
  public override readonly alias: string;
  public override readonly depth: number;

  public constructor(
    public readonly parent: TableReference,
    public readonly edgeOrUniqueReverseEdge: core.Edge | core.UniqueReverseEdge,
  ) {
    const head = parent.table.schema.getTableByNode(
      edgeOrUniqueReverseEdge.head,
    );
    super(head, parent.context);

    this.authorization = parent.context.getAuthorization(
      edgeOrUniqueReverseEdge.head,
    );
    this.alias = `${parent.alias}>${edgeOrUniqueReverseEdge.name}`;
    this.depth = parent.depth + 1;
  }

  public get kind(): JoinTableKind {
    return (this.parent instanceof JoinTable &&
      this.parent.kind === JoinTableKind.LEFT) ||
      this.edgeOrUniqueReverseEdge.isNullable()
      ? JoinTableKind.LEFT
      : JoinTableKind.INNER;
  }

  @Memoize()
  public get condition(): string {
    return [
      ...(this.edgeOrUniqueReverseEdge instanceof core.Edge
        ? this.parent.table
            .getForeignKeyByEdge(this.edgeOrUniqueReverseEdge)
            .columns.map(
              (column) =>
                `${this.parent.getEscapedColumnIdentifier(
                  column,
                )} <=> ${this.getEscapedColumnIdentifier(
                  column.referencedColumn,
                )}`,
            )
        : this.table
            .getForeignKeyByEdge(this.edgeOrUniqueReverseEdge.originalEdge)
            .columns.map(
              (column) =>
                `${this.parent.getEscapedColumnIdentifier(
                  column.referencedColumn,
                )} <=> ${this.getEscapedColumnIdentifier(column)}`,
            )),
      this.authorization ? filterNode(this, this.authorization) : undefined,
    ]
      .filter(Boolean)
      .join(' AND ');
  }

  public override toString(): string {
    return [
      `${JoinTableKind[this.kind]} JOIN ${escapeIdentifier(
        this.table.name,
      )} AS ${escapeIdentifier(this.alias)} ON ${this.condition}`,
      ...Array.from(this.joinsByAlias.values(), (joinTable) =>
        joinTable.toString(),
      ),
    ].join(' ');
  }
}
