import { AnyRelation, Relation } from '@prismamedia/graphql-platform-core';
import { SuperMap } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { Resource } from '../../../../resource';
import { Database } from '../../../database';
import { Table } from '../../table';
import { WhereConditionAnd } from './where';

export type TableReference = TableFactor | JoinTable;

class JoinTableMap extends SuperMap<JoinTable['alias'], JoinTable> {}

abstract class AbstractTableReference {
  readonly database: Database;
  readonly resource: Resource;
  readonly joinTableMap: JoinTableMap = new JoinTableMap();

  public constructor(readonly table: Table) {
    this.database = table.database;
    this.resource = table.resource;
  }

  public abstract get alias(): string;

  public isToMany(): boolean {
    return this.joinTableMap.some(([, joinTable]) => joinTable.relation.isToMany() || joinTable.isToMany());
  }

  @Memoize((relation: AnyRelation, key?: string) => [relation.name, key].filter(Boolean).join('/'))
  public join(relation: AnyRelation, key?: string): JoinTable {
    const joinTable = new JoinTable(this, relation, key);
    this.joinTableMap.set(joinTable.alias, joinTable);

    return joinTable;
  }

  public abstract get sql(): string;
}

export class TableFactor extends AbstractTableReference {
  @Memoize()
  public get alias(): string {
    return this.table.resource.name;
  }

  @Memoize()
  public get sql(): string {
    return [this.table.getEscapedName(this.alias), ...[...this.joinTableMap.values()].map(({ sql }) => sql)]
      .filter(Boolean)
      .join(' ');
  }
}

export class JoinTable extends AbstractTableReference {
  public constructor(readonly parent: TableReference, readonly relation: AnyRelation, readonly key?: string) {
    super(parent.database.getTable(relation.getTo()));
  }

  @Memoize()
  public get alias(): string {
    return [this.parent.alias, [this.relation.name, this.key].filter(Boolean).join('/')].join('>');
  }

  @Memoize()
  public get joinCondition(): WhereConditionAnd {
    const joinCondition = new WhereConditionAnd(this);

    if (this.relation instanceof Relation) {
      for (const column of this.parent.table.getForeignKey(this.relation).getColumnSet()) {
        joinCondition.addRaw(
          [
            column.getEscapedName(this.parent.alias),
            column.nullable && column.reference.nullable ? '<=>' : '=',
            column.reference.getEscapedName(this.alias),
          ].join(' '),
        );
      }
    } else {
      for (const column of this.table.getForeignKey(this.relation.getInverse()).getColumnSet()) {
        joinCondition.addRaw(
          [
            column.reference.getEscapedName(this.parent.alias),
            column.reference.nullable && column.nullable ? '<=>' : '=',
            column.getEscapedName(this.alias),
          ].join(' '),
        );
      }
    }

    return joinCondition;
  }

  public get sql(): string {
    return [
      'LEFT JOIN',
      this.table.getEscapedName(this.alias),
      `ON`,
      this.joinCondition.sql,
      ...[...this.joinTableMap.values()].map(({ sql }) => sql),
    ]
      .filter(Boolean)
      .join(' ');
  }
}
