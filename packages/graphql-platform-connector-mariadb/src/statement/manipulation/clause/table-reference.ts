import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { Merge } from 'type-fest';
import type { MariaDBBrokerSubscriptionsStateTable } from '../../../broker/table/subscriptions-state.js';
import { escapeIdentifier } from '../../../escaping.js';
import type { Column, Table } from '../../../schema.js';
import {
  AuthorizedTableCTE,
  AuthorizedTableDerivedTable,
  Subquery,
  type AbstractSelectOptions,
  type AuthorizedTable,
} from '../query/select.js';
import { AND, filterNode, type WhereCondition } from './where-condition.js';

export abstract class AbstractTableReference {
  public abstract readonly root: TableFactor;
  public abstract readonly source: AuthorizedTable | Table;
  public abstract readonly alias: string;

  public readonly joinsByAlias = new Map<JoinTable['alias'], JoinTable>();
  public readonly subqueries = new Set<TableFactor>();

  public constructor(
    public readonly table: Table,
    public readonly context?: core.OperationContext,
  ) {}

  public abstract toString(): string;

  public isRoot(): this is TableFactor {
    assert(isTableReference(this));

    return this.root === this;
  }

  public authorize(table: Table): AuthorizedTable | Table {
    const authorization = this.context?.getAuthorization(table.node);
    if (authorization) {
      assert(isTableReference(this));

      if (this.root.useCommonTableExpression) {
        let authorizedTable = this.root.authorizedTables.get(table);

        if (!authorizedTable) {
          this.root.authorizedTables.set(
            table,
            (authorizedTable = new AuthorizedTableCTE(
              new TableFactor(table, { parent: this }),
              authorization,
            )),
          );
        }

        return authorizedTable;
      } else {
        return new AuthorizedTableDerivedTable(
          new TableFactor(table, { parent: this }),
          authorization,
        );
      }
    }

    return table;
  }

  public escapeColumnIdentifier(column: Column): string {
    assert(this.table.columns.includes(column));

    return escapeIdentifier(`${this.alias}.${column.name}`);
  }

  public escapeColumnIdentifierByLeaf(leaf: core.Leaf): string {
    return this.escapeColumnIdentifier(this.table.getColumnByLeaf(leaf));
  }

  public getJoinConditions(
    edgeOrReverseEdge: core.Edge | core.ReverseEdge,
    head: TableReference,
  ): Array<WhereCondition> {
    assert.strictEqual(edgeOrReverseEdge.tail, this.table.node);
    assert.strictEqual(edgeOrReverseEdge.head, head.table.node);

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
    assert.strictEqual(edgeOrUniqueReverseEdge.tail, this.table.node);
    assert(isTableReference(this));

    const joinTable = new JoinTable(this, edgeOrUniqueReverseEdge);

    const maybeExistingJoinTable = this.joinsByAlias.get(joinTable.alias);

    // We join a table only once
    if (maybeExistingJoinTable) {
      return maybeExistingJoinTable;
    }

    this.joinsByAlias.set(joinTable.alias, joinTable);

    return joinTable;
  }

  public subquery(
    edgeOrReverseEdge: core.Edge | core.ReverseEdge,
    options?: Merge<AbstractSelectOptions, { where?: core.NodeFilter }>,
  ): Subquery {
    assert.strictEqual(edgeOrReverseEdge.tail, this.table.node);
    assert(isTableReference(this));

    const tableReference = new TableFactor(
      this.table.schema.getTableByNode(edgeOrReverseEdge.head),
      {
        context: this.context,
        alias: `${this.alias}>${edgeOrReverseEdge.name}`,
        parent: this,
      },
    );

    this.subqueries.add(tableReference);

    const joinConditions = this.getJoinConditions(
      edgeOrReverseEdge,
      tableReference,
    );

    const where = options?.where
      ? filterNode(tableReference, options.where)
      : undefined;

    return new Subquery(tableReference, {
      ...options,
      where: AND([...joinConditions, where], false),
      limit:
        options?.limit ??
        (edgeOrReverseEdge instanceof core.MultipleReverseEdge ? undefined : 1),
    });
  }
}

export interface TableFactorOptions {
  readonly context?: core.OperationContext;
  readonly alias?: string;
  readonly parent?: TableReference;
  readonly useCommonTableExpression?: boolean;
}

export class TableFactor extends AbstractTableReference {
  public readonly useCommonTableExpression: boolean;

  public override readonly root: TableFactor;
  public override readonly source: AuthorizedTable | Table;
  public override readonly alias: string;

  public readonly authorizedTables = new Map<Table, AuthorizedTableCTE>();

  #joinSubscriptionsStateTable?: JoinSubscriptionsStateTable;

  public constructor(table: Table, options?: TableFactorOptions) {
    super(table, options?.context);

    this.useCommonTableExpression = utils.getOptionalFlag(
      options?.useCommonTableExpression,
      false,
    );

    this.root = options?.parent?.root ?? this;
    this.source = !this.root && this.context ? this.authorize(table) : table;
    this.alias = options?.alias ?? table.name;
  }

  public joinSubscriptionsState(
    subscriptionId: core.ChangesSubscriptionStream['id'],
  ): JoinSubscriptionsStateTable {
    assert(this.isRoot());

    let joinSubscriptionsStateTable = this.#joinSubscriptionsStateTable;
    if (joinSubscriptionsStateTable) {
      assert.strictEqual(
        joinSubscriptionsStateTable.subscriptionId,
        subscriptionId,
      );

      return joinSubscriptionsStateTable;
    }

    assert(
      this.table.subscriptionsStateTable,
      `The table "${this.table.name}" has no "subscriptions' state" table`,
    );

    return (this.#joinSubscriptionsStateTable ??=
      new JoinSubscriptionsStateTable(
        this,
        this.table.subscriptionsStateTable,
        subscriptionId,
      ));
  }

  @MMethod()
  public override toString(): string {
    return [
      this.source instanceof AuthorizedTableDerivedTable
        ? `${this.source} AS ${escapeIdentifier(this.alias)}`
        : `${escapeIdentifier(this.source.name)}${
            this.alias === this.source.name
              ? ''
              : ` AS ${escapeIdentifier(this.alias)}`
          }`,
      ...Array.from(this.joinsByAlias.values(), String),
      this.#joinSubscriptionsStateTable?.toString(),
    ]
      .filter(Boolean)
      .join(' ');
  }
}

export enum JoinTableKind {
  LEFT,
  INNER,
}

export class JoinTable extends AbstractTableReference {
  public override readonly root: TableFactor;
  public override readonly source: AuthorizedTable | Table;
  public override readonly alias: string;

  public constructor(
    public readonly parent: TableReference,
    public readonly edgeOrUniqueReverseEdge: core.Edge | core.UniqueReverseEdge,
  ) {
    assert(
      edgeOrUniqueReverseEdge instanceof core.Edge ||
        edgeOrUniqueReverseEdge instanceof core.UniqueReverseEdge,
    );
    assert.strictEqual(edgeOrUniqueReverseEdge.tail, parent.table.node);

    super(
      parent.table.schema.getTableByNode(edgeOrUniqueReverseEdge.head),
      parent.context,
    );

    this.root = parent.root;
    this.source = this.context ? this.authorize(this.table) : this.table;
    this.alias = `${parent.alias}>${edgeOrUniqueReverseEdge.name}`;
  }

  @MGetter
  public get kind(): JoinTableKind {
    return (this.parent instanceof JoinTable &&
      this.parent.kind === JoinTableKind.LEFT) ||
      this.edgeOrUniqueReverseEdge.isNullable()
      ? JoinTableKind.LEFT
      : JoinTableKind.INNER;
  }

  @MGetter
  public get condition(): WhereCondition {
    return AND(
      this.parent.getJoinConditions(this.edgeOrUniqueReverseEdge, this),
      false,
    );
  }

  @MMethod()
  public override toString(): string {
    return [
      `${JoinTableKind[this.kind]} JOIN ${
        this.source instanceof AuthorizedTableDerivedTable
          ? this.source
          : escapeIdentifier(this.source.name)
      } AS ${escapeIdentifier(this.alias)} ON ${this.condition}`,
      ...Array.from(this.joinsByAlias.values(), String),
    ].join(' ');
  }
}

export class JoinSubscriptionsStateTable {
  public readonly alias: string;

  public constructor(
    public readonly parent: TableReference,
    public readonly table: MariaDBBrokerSubscriptionsStateTable,
    public readonly subscriptionId: core.ChangesSubscriptionStream['id'],
  ) {
    this.alias = `${parent.alias}>${table.name}`;
  }

  public toString(): string {
    const subscriptionIdColumn = this.table.getColumnByName('subscriptionId');

    return `${JoinTableKind[JoinTableKind.LEFT]} JOIN ${escapeIdentifier(
      this.table.name,
    )} AS ${escapeIdentifier(this.alias)} ON ${AND([
      ...this.table.references.map(
        ({ source, target }) =>
          `${escapeIdentifier(`${this.alias}.${source.name}`)} = ${this.parent.escapeColumnIdentifier(target)}`,
      ),
      `${escapeIdentifier(`${this.alias}.${subscriptionIdColumn.name}`)} = ${subscriptionIdColumn.dataType.serialize(this.subscriptionId)}`,
    ])}`;
  }

  public escapeColumnIdentifier(columnOrName: Column | Column['name']): string {
    const column =
      typeof columnOrName === 'string'
        ? this.table.getColumnByName(columnOrName)
        : columnOrName;
    assert(column);

    return escapeIdentifier(`${this.alias}.${column.name}`);
  }
}

export type TableReference = TableFactor | JoinTable;

export function isTableReference(
  maybeTableReference: unknown,
): maybeTableReference is TableReference {
  return (
    maybeTableReference instanceof TableFactor ||
    maybeTableReference instanceof JoinTable
  );
}
