import { AnyRelation } from '@prismamedia/graphql-platform-core';
import { MaybeArray, SuperSet } from '@prismamedia/graphql-platform-utils';
import { escape } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Column, ColumnReference, Table } from '../..';
import { Resource } from '../../../../resource';
import { Database } from '../../../database';
import { ColumnValue } from '../column';
import { TableReference } from './reference';

export type WhereConditionBool = WhereConditionAnd | WhereConditionOr;
export type WhereCondition = WhereConditionRaw | WhereConditionNot | WhereConditionBool;

class WhereConditionRaw {
  public constructor(protected condition: string) {}

  public get sql(): string | null {
    return this.condition || null;
  }
}

export class WhereConditionNot {
  public constructor(protected condition: WhereCondition) {}

  public get sql(): string | null {
    return this.condition.sql ? `NOT (${this.condition.sql})` : null;
  }
}

abstract class AbstractWhereConditionBool extends SuperSet<WhereCondition> {
  readonly database: Database;
  readonly resource: Resource;
  readonly table: Table;
  protected abstract BOOL_OPERATOR: string;

  public constructor(readonly tableReference: TableReference) {
    super();
    this.resource = tableReference.resource;
    this.database = tableReference.database;
    this.table = tableReference.table;
  }

  public addRaw(condition: string): this {
    return this.add(new WhereConditionRaw(condition));
  }

  public addFilter(
    column: Column | ColumnReference,
    operator: string,
    value?: MaybeArray<NonNullable<ColumnValue>>,
  ): this {
    return this.addRaw(
      [
        column.getEscapedName(this.tableReference.alias),
        operator,
        typeof value === 'undefined'
          ? undefined
          : Array.isArray(value)
          ? `(${escape(value.filter(subValue => typeof subValue !== 'undefined'))})`
          : escape(value),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  public addAnd(callback: (where: WhereConditionAnd) => void): this {
    const where = new WhereConditionAnd(this.tableReference);
    callback(where);
    this.add(where);

    return this;
  }

  public addOr(callback: (where: WhereConditionOr) => void): this {
    const where = new WhereConditionOr(this.tableReference);
    callback(where);
    this.add(where);

    return this;
  }

  public addNotAnd(callback: (where: WhereConditionAnd) => void): this {
    const where = new WhereConditionAnd(this.tableReference);
    callback(where);
    this.add(new WhereConditionNot(where));

    return this;
  }

  public addNotOr(callback: (where: WhereConditionOr) => void): this {
    const where = new WhereConditionOr(this.tableReference);
    callback(where);
    this.add(new WhereConditionNot(where));

    return this;
  }

  public on(relation: AnyRelation, callback: (where: WhereConditionAnd) => void): this {
    const joinTable = this.tableReference.join(relation);
    const where = new WhereConditionAnd(joinTable);
    callback(where);
    this.add(where);

    return this;
  }

  public getNormalizedSet(): SuperSet<WhereCondition> {
    // TODO: normalize

    return this;
  }

  @Memoize()
  public get sql(): string | null {
    const conditionSet = this.getNormalizedSet();

    return conditionSet.size > 0
      ? [...conditionSet].map(({ sql }) => (conditionSet.size > 1 ? `(${sql})` : sql)).join(` ${this.BOOL_OPERATOR} `)
      : null;
  }
}

export class WhereConditionAnd extends AbstractWhereConditionBool {
  protected BOOL_OPERATOR = 'AND';
}

export class WhereConditionOr extends AbstractWhereConditionBool {
  protected BOOL_OPERATOR = 'OR';
}
