import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { escapeIdentifier } from '../../../escaping.js';
import type { Column, Table } from '../../../schema.js';
import { orderNode } from './ordering-expression.js';
import {
  JoinTable,
  TableFactor,
  type TableReference,
} from './table-reference.js';
import { filterNode, type WhereCondition } from './where-condition.js';

export abstract class AbstractTableReference {
  public abstract readonly alias: string;

  /**
   * The depth of a node is the number of edges from the node to the tree's root node.
   * A root node will have a depth of 0.
   */
  public abstract readonly depth: number;

  public readonly joinsByAlias = new Map<JoinTable['alias'], JoinTable>();
  public readonly subqueries = new Set<TableFactor>();

  public constructor(
    public readonly table: Table,
    public readonly context: core.OperationContext,
  ) {}

  public abstract toString(): string;

  /**
   * The height of a node is the number of edges on the longest path from the node to a leaf.
   * A leaf node will have a height of 0.
   */
  public get height(): number {
    return this.joinsByAlias.size || this.subqueries.size
      ? Math.max(
          ...Array.from(this.joinsByAlias.values(), (child) => child.height),
          ...Array.from(this.subqueries, (child) => child.height),
        ) + 1
      : 0;
  }

  public getJoinConditions(
    edgeOrReverseEdge: core.Edge | core.ReverseEdge,
    head: TableReference,
  ): Array<WhereCondition> {
    assert.equal(edgeOrReverseEdge.tail, this.table.node);
    assert.equal(edgeOrReverseEdge.head, head.table.node);

    return edgeOrReverseEdge instanceof core.Edge
      ? this.table
          .getForeignKeyByEdge(edgeOrReverseEdge)
          .getJoinConditions(this, head)
      : head.table
          .getForeignKeyByEdge(edgeOrReverseEdge.originalEdge)
          .getJoinConditions(head, this);
  }

  public join(
    edgeOrUniqueReverseEdge: core.Edge | core.UniqueReverseEdge,
  ): JoinTable {
    assert(
      edgeOrUniqueReverseEdge instanceof core.Edge ||
        edgeOrUniqueReverseEdge instanceof core.UniqueReverseEdge,
    );
    assert.equal(edgeOrUniqueReverseEdge.tail, this.table.node);

    const joinTable = new JoinTable(this, edgeOrUniqueReverseEdge);

    const maybeExistingJoinTable = this.joinsByAlias.get(joinTable.alias);

    // We join a table only once
    if (maybeExistingJoinTable) {
      return maybeExistingJoinTable;
    }

    this.joinsByAlias.set(joinTable.alias, joinTable);

    return joinTable;
  }

  /**
   * @see https://mariadb.com/kb/en/subqueries/
   */
  public subquery(
    edgeOrReverseEdge: core.Edge | core.ReverseEdge,
    selectExpressions: utils.Thunkable<string, [headReference: TableFactor]>,
    headFilter?: core.NodeFilter,
    headOrdering?: core.NodeOrdering,
    offset?: number | null,
    limit?: number | null,
  ): string {
    assert.equal(edgeOrReverseEdge.tail, this.table.node);

    const headAuthorization = this.context.getAuthorization(
      edgeOrReverseEdge.head,
    );

    const headTable = this.table.schema.getTableByNode(edgeOrReverseEdge.head);

    const headReference = new TableFactor(
      headTable,
      this.context,
      `${this.alias}>${edgeOrReverseEdge.name}`,
      this.depth + 1,
    );

    this.subqueries.add(headReference);

    const mergedAuthorizationAndFilter =
      headAuthorization && headFilter
        ? headAuthorization.and(headFilter).normalized
        : headAuthorization || headFilter;

    const whereCondition: WhereCondition = [
      ...this.getJoinConditions(edgeOrReverseEdge, headReference),
      mergedAuthorizationAndFilter
        ? filterNode(headReference, mergedAuthorizationAndFilter)
        : undefined,
    ]
      .filter(Boolean)
      .join(' AND ');

    const orderingExpressions = headOrdering
      ? orderNode(headReference, headOrdering)
      : undefined;

    return `(${[
      `SELECT ${utils.resolveThunkable(selectExpressions, headReference)}`,
      `FROM ${headReference}`,
      `WHERE ${whereCondition}`,
      orderingExpressions && `ORDER BY ${orderingExpressions}`,
      limit != null
        ? `LIMIT ${limit}`
        : edgeOrReverseEdge instanceof core.Edge ||
          edgeOrReverseEdge instanceof core.UniqueReverseEdge
        ? `LIMIT 1`
        : undefined,
      offset && `OFFSET ${offset}`,
    ]
      .filter(Boolean)
      .join(' ')})`;
  }

  public getEscapedColumnIdentifier(column: Column): string {
    assert(this.table.columns.includes(column));

    return escapeIdentifier(`${this.alias}.${column.name}`);
  }

  public getEscapedColumnIdentifierByLeaf(leaf: core.Leaf): string {
    return this.getEscapedColumnIdentifier(this.table.getColumnByLeaf(leaf));
  }
}
