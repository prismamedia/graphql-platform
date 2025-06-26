import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import type { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { TableFactor } from './clause/table-reference.js';
import { AbstractSelect, type AbstractSelectOptions } from './query/select.js';

export interface SelectStatementOptions extends AbstractSelectOptions {
  readonly useCommonTableExpression?: boolean;
}

export class SelectStatement
  extends AbstractSelect
  implements mariadb.QueryOptions
{
  public readonly kind = StatementKind.DATA_MANIPULATION;

  public constructor(
    table: Table,
    context: core.OperationContext,
    options?: SelectStatementOptions,
  ) {
    const tableReference = new TableFactor(table, {
      context,
      useCommonTableExpression:
        table.schema.connector.useCommonTableExpression &&
        utils.getOptionalFlag(options?.useCommonTableExpression, true),
    });
    super(tableReference, options);
  }

  public get sql(): string {
    return this.toString();
  }
}
