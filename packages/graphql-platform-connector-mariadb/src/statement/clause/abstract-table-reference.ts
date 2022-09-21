import type * as core from '@prismamedia/graphql-platform';
import type { Table } from '../../schema.js';
import { JoinTable } from './table-reference/join-table.js';

export abstract class AbstractTableReference {
  public abstract readonly alias: string;

  /**
   * The depth of a node is the number of edges from the node to the tree's root node.
   * A root node will have a depth of 0.
   */
  public abstract readonly depth: number;

  public readonly children = new Map<JoinTable['alias'], JoinTable>();

  public constructor(public readonly table: Table) {}

  public abstract toString(): string;

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
    const joinTable = new JoinTable(this, edge, key);

    const maybeExistingJoinTable = this.children.get(joinTable.alias);

    // We join a table only once per its alias
    if (maybeExistingJoinTable) {
      return maybeExistingJoinTable;
    }

    this.children.set(joinTable.alias, joinTable);

    return joinTable;
  }
}
