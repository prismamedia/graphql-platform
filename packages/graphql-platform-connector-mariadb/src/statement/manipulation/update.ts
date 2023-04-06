import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { TableFactor } from './clause/table-reference.js';
import { filterNode } from './clause/where-condition.js';

export interface UpdateStatementConfig {
  /**
   * @see https://mariadb.com/kb/en/ignore/
   */
  ignore?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/update/
 */
export class UpdateStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    statement: core.ConnectorUpdateStatement,
    context: core.MutationContext,
    config?: UpdateStatementConfig,
  ) {
    assert(!statement.update.isEmpty(), 'Empty update statement');

    const tableReference = new TableFactor(table, context);

    const whereCondition = filterNode(tableReference, statement.filter);

    this.sql = [
      ['UPDATE', config?.ignore === true && 'IGNORE', tableReference.toString()]
        .filter(Boolean)
        .join(' '),
      `SET ${Array.from(statement.update.updatesByComponent)
        .flatMap<string>(([component, update]) => {
          if (component instanceof core.Leaf) {
            const column = table.getColumnByLeaf(component);

            return `${tableReference.getEscapedColumnIdentifier(
              column,
            )}=${column.dataType.serialize(
              update as utils.NonOptional<core.LeafUpdateValue>,
            )}`;
          } else {
            return table
              .getColumnTreeByEdge(component)
              .columns.map(
                (column) =>
                  `${tableReference.getEscapedColumnIdentifier(
                    column,
                  )}=${column.dataType.serialize(
                    column.pickLeafValueFromReferenceValue(
                      update as utils.NonOptional<core.EdgeUpdateValue>,
                    ),
                  )}`,
              );
          }
        })
        .join(', ')}`,
      `WHERE ${whereCondition}`,
      ,
    ].join(EOL);
  }
}
