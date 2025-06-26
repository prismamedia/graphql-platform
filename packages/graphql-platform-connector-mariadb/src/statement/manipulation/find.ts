import type * as core from '@prismamedia/graphql-platform';
import { MMethod } from '@prismamedia/memoize';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema.js';
import { selectNode } from './clause/select-expression.js';
import { AND, filterNode } from './clause/where-condition.js';
import { SelectStatement } from './select.js';

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement extends SelectStatement {
  public readonly selectionKey: string;

  public constructor(
    public readonly table: Table,
    public readonly context: core.OperationContext,
    protected readonly statement: SetOptional<
      core.ConnectorFindStatement,
      'node'
    >,
  ) {
    const selectionKey = `_${table.node.name}`;

    super(table, context, {
      select: (tableReference) => [
        `${selectNode(
          tableReference,
          statement.selection,
        )} as ${escapeIdentifier(selectionKey)}`,
        statement.forSubscription &&
          table.subscriptionsStateTable?.select(
            tableReference,
            statement.forSubscription,
          ),
      ],
      where: (tableReference) =>
        statement.filter ||
        (statement.forSubscription && table.subscriptionsStateTable)
          ? AND(
              [
                statement.filter &&
                  filterNode(tableReference, statement.filter),
                statement.forSubscription &&
                  table.subscriptionsStateTable?.filter(
                    tableReference,
                    statement.forSubscription,
                  ),
              ],
              false,
            )
          : undefined,
      having: (tableReference) =>
        statement.forSubscription
          ? table.subscriptionsStateTable?.having(
              tableReference,
              selectionKey,
              statement.forSubscription,
            )
          : undefined,
      ordering: statement.ordering,
      limit: statement.limit,
      offset: statement.offset,
      forUpdate: statement.forMutation != null,
    });

    this.selectionKey = selectionKey;
  }

  @MMethod()
  public override toString(): string {
    const sql = super.toString();

    return this.table.subscriptionsStateTable && this.statement.forSubscription
      ? this.table.subscriptionsStateTable.wrap(
          sql,
          this.selectionKey,
          this.statement.forSubscription,
        )
      : sql;
  }
}
