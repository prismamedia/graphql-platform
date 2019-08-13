import { Relation } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { escapeId } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { RelationConfig } from '../../../resource/component';
import { Table } from '../table';
import { ColumnReference } from './column-reference';
import { ColumnSet } from './column/set';

export * from './foreign-key/set';

export enum ReferentialAction {
  'CASCADE' = 'CASCADE',
  'RESTRICT' = 'RESTRICT',
  'SET DEFAULT' = 'SET DEFAULT',
  'SET NULL' = 'SET NULL',
}

export interface ForeignKeyConfig {
  /** Optional, the foreign key index's name, default: computed from components' name */
  name?: Maybe<string>;
}

export class ForeignKey {
  public constructor(readonly table: Table, readonly relation: Relation<RelationConfig>) {}

  @Memoize()
  public get config(): ForeignKeyConfig {
    return this.relation.config.foreignKey || {};
  }

  @Memoize()
  public getFrom(): Table {
    return this.table.database.getTable(this.relation.getFrom());
  }

  @Memoize()
  public getTo(): Table {
    return this.table.database.getTable(this.relation.getTo());
  }

  @Memoize()
  public get name(): string | undefined {
    return this.config.name ? this.config.name.substr(0, 64) : undefined;
  }

  public getEscapedName(alias?: string): string {
    return [alias, this.name]
      .map(value => value && escapeId(value))
      .filter(Boolean)
      .join('.');
  }

  @Memoize()
  public getColumnSet(): ColumnSet<ColumnReference> {
    const columnSet = new ColumnSet<ColumnReference>();

    const referencedColumnSet = this.getTo().getComponentSetColumnSet(this.relation.getToUnique().componentSet);
    for (const column of referencedColumnSet) {
      columnSet.add(new ColumnReference(this.table, this.relation, column));
    }

    return columnSet;
  }

  @Memoize()
  public getNonNullableReferenceSet() {
    return this.getColumnSet().filter(column => !column.reference.nullable);
  }

  @Memoize()
  public getFirstNonNullableReference() {
    return this.getNonNullableReferenceSet().first(true);
  }

  @Memoize()
  public get onDelete(): ReferentialAction {
    return ReferentialAction.RESTRICT;
  }

  @Memoize()
  public get onUpdate(): ReferentialAction {
    return ReferentialAction.RESTRICT;
  }
}
