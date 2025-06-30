import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MMethod } from '@prismamedia/memoize';
import * as R from 'remeda';
import { escapeIdentifier } from '../../../escaping.js';
import {
  orderNode,
  type OrderingExpression,
} from '../clause/ordering-expression.js';
import {
  selectNode,
  type SelectExpression,
} from '../clause/select-expression.js';
import {
  InlineTableAuthorization,
  type TableFactor,
} from '../clause/table-reference.js';
import {
  AND,
  filterNode,
  type WhereCondition,
} from '../clause/where-condition.js';

export interface AbstractSelectOptions {
  select?: utils.Thunkable<
    | core.NodeSelection
    | utils.ReadonlyArrayable<SelectExpression | null | undefined>
    | undefined,
    [tableReference: TableFactor]
  >;
  where?: utils.Thunkable<
    core.NodeFilter | WhereCondition | undefined,
    [tableReference: TableFactor]
  >;
  having?: utils.Thunkable<
    WhereCondition | undefined,
    [tableReference: TableFactor]
  >;
  ordering?: utils.Thunkable<
    core.NodeOrdering | utils.ReadonlyArrayable<OrderingExpression> | undefined,
    [tableReference: TableFactor]
  >;
  offset?: number;
  limit?: number;
  forUpdate?: boolean;
}

export abstract class AbstractSelect {
  public readonly selectExpressions: ReadonlyArray<SelectExpression>;
  public readonly whereCondition?: WhereCondition;
  public readonly havingCondition?: WhereCondition;
  public readonly orderingExpressions?: ReadonlyArray<OrderingExpression>;
  public readonly limit?: number;
  public readonly offset?: number;
  public readonly forUpdate?: boolean;

  public constructor(
    public readonly tableReference: TableFactor,
    options?: AbstractSelectOptions,
  ) {
    {
      const rawSelect = utils.resolveThunkable(options?.select, tableReference);

      const selectExpressions = rawSelect
        ? R.pipe(
            utils.resolveArrayable(
              rawSelect instanceof core.NodeSelection
                ? selectNode(tableReference, rawSelect)
                : rawSelect,
            ),
            R.filter(R.isNonNullish),
          )
        : undefined;

      this.selectExpressions = selectExpressions?.length
        ? selectExpressions
        : ['*'];
    }

    {
      const rawWhere = utils.resolveThunkable(options?.where, tableReference);
      const whereCondition =
        rawWhere instanceof core.NodeFilter
          ? filterNode(tableReference, rawWhere)
          : rawWhere;

      this.whereCondition =
        tableReference.source instanceof InlineTableAuthorization
          ? AND([whereCondition, tableReference.source.condition], false)
          : whereCondition;
    }

    {
      this.havingCondition = utils.resolveThunkable(
        options?.having,
        tableReference,
      );
    }

    {
      const rawOrdering = utils.resolveThunkable(
        options?.ordering,
        tableReference,
      );

      this.orderingExpressions = rawOrdering
        ? utils.resolveArrayable(
            rawOrdering instanceof core.NodeOrdering
              ? orderNode(tableReference, rawOrdering)
              : rawOrdering,
          )
        : undefined;
    }

    this.limit = options?.limit ?? undefined;
    this.offset = options?.offset || undefined;
  }

  @MMethod()
  public toString(): string {
    return [
      this.tableReference.authorizedTables.size &&
        `WITH ${Array.from(this.tableReference.authorizedTables.values(), String).join()}`,
      `SELECT ${this.selectExpressions.join()}`,
      `FROM ${this.tableReference}`,
      this.whereCondition && `WHERE ${this.whereCondition}`,
      this.havingCondition && `HAVING ${this.havingCondition}`,
      this.orderingExpressions?.length &&
        `ORDER BY ${this.orderingExpressions.join()}`,
      this.limit !== undefined && `LIMIT ${this.limit}`,
      this.offset && `OFFSET ${this.offset}`,
      this.forUpdate && 'FOR UPDATE',
    ]
      .filter(Boolean)
      .join(' ');
  }
}

export class Subquery extends AbstractSelect {
  @MMethod()
  public override toString(): string {
    return `(${super.toString()})`;
  }
}

export abstract class AbstractAuthorizedTable extends Subquery {
  public constructor(tableReference: TableFactor, filter: core.NodeFilter) {
    super(tableReference, {
      select: `${tableReference.alias}.*`,
      where: filter,
    });
  }
}

export class AuthorizedTableCTE extends AbstractAuthorizedTable {
  public readonly name: string = `authorized_${this.tableReference.table.name}`;

  @MMethod()
  public override toString(): string {
    return `${escapeIdentifier(this.name)} AS ${super.toString()}`;
  }
}

export class AuthorizedTableDerivedTable extends AbstractAuthorizedTable {}
