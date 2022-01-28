import type * as core from '@prismamedia/graphql-platform';
import type { Table } from '../../schema.js';

export abstract class AbstractTableReference {
  public abstract readonly alias: string;

  /**
   * The depth of a node is the number of edges from the node to the tree's root node.
   * A root node will have a depth of 0.
   */
  public abstract readonly depth: number;

  public readonly children = new Map<JoinTable['alias'], JoinTable>();

  public constructor(public readonly table: Table) {}

  /**
   * The height of a node is the number of edges on the longest path from the node to a leaf.
   * A leaf node will have a height of 0.
   */
  public get height(): number {
    return this.children.size
      ? Math.max(
          ...Array.from(this.children.values(), (child) => child.height),
        ) + 1
      : 0;
  }

  public join(edge: core.Edge | core.ReverseEdge, key?: string): JoinTable {
    const joinTable = new JoinTable(
      this,
      this.table.schema.getTableByNode(edge.head),
    );

    const maybeExistingJoinTable = this.children.get(joinTable.alias);

    // We join a table only once per its alias
    if (maybeExistingJoinTable) {
      return maybeExistingJoinTable;
    }

    this.children.set(joinTable.alias, joinTable);

    return joinTable;
  }
}

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class TableFactor extends AbstractTableReference {
  public override readonly alias: string;
  public override readonly depth: number = 0;

  public constructor(table: Table) {
    super(table);

    this.alias = table.name;
  }
}

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class JoinTable extends AbstractTableReference {
  public override readonly alias: string;
  public override readonly depth: number;

  public constructor(
    public readonly parent: TableReference,
    table: Table,
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
    super(table);

    this.alias = `${parent.alias}>${key || table.name}`;
    this.depth = parent.depth + 1;
  }
}

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export type TableReference = TableFactor | JoinTable;
