import * as core from '@prismamedia/graphql-platform';
import { MGetter } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../../escaping.js';
import { AbstractTableReference } from '../abstract-table-reference.js';
import { type WhereCondition, filterNode } from '../where-condition.js';

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

  protected readonly authorization?: core.NodeFilter;

  public constructor(
    public readonly parent: AbstractTableReference,
    public readonly edgeOrUniqueReverseEdge: core.Edge | core.UniqueReverseEdge,
  ) {
    super(
      parent.table.schema.getTableByNode(edgeOrUniqueReverseEdge.head),
      parent.context,
    );

    this.alias = `${parent.alias}>${edgeOrUniqueReverseEdge.name}`;
    this.depth = parent.depth + 1;

    this.authorization = this.context.getAuthorization(
      edgeOrUniqueReverseEdge.head,
    );
  }

  public get kind(): JoinTableKind {
    return (this.parent instanceof JoinTable &&
      this.parent.kind === JoinTableKind.LEFT) ||
      this.edgeOrUniqueReverseEdge.isNullable()
      ? JoinTableKind.LEFT
      : JoinTableKind.INNER;
  }

  @MGetter
  public get condition(): WhereCondition {
    return [
      ...this.parent.getJoinConditions(this.edgeOrUniqueReverseEdge, this),
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
