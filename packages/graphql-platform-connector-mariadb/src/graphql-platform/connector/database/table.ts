import {
  Component,
  ComponentSet,
  Field,
  FieldValue,
  NodeValue,
  Relation,
  Resource,
} from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import inflector from 'inflection';
import { escapeId } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { ResourceConfig } from '../../resource';
import { Database } from '../database';
import { OperationConstructor, OperationId, operationMap } from './operation';
import { Column, ColumnSet } from './table/column';
import { ColumnReference } from './table/column-reference';
import { ForeignKey, ForeignKeySet } from './table/foreign-key';
import { PrimaryKey } from './table/primary-key';
import { DeleteStatement, InsertStatement, SelectStatement, UpdateStatement } from './table/statement';
import { UniqueIndex, UniqueIndexSet } from './table/unique-index';

export * from './table/column';
export * from './table/column-reference';
export * from './table/foreign-key';
export * from './table/primary-key';
export * from './table/set';
export * from './table/unique-index';

export interface TableConfig {
  /** Optional, the table's name, default: resource's plural name snake cased */
  name?: Maybe<string>;

  /** Optional, the table's charset, default: utf8mb4 */
  charset?: Maybe<string>;

  /** Optional, the table's collation, default: utf8mb4_unicode_520_ci */
  collation?: Maybe<string>;
}

export class Table {
  public constructor(readonly database: Database, readonly resource: Resource<ResourceConfig>) {}

  public get config(): TableConfig {
    return this.resource.config.table || {};
  }

  @Memoize()
  public get name(): string {
    return this.config.name || inflector.underscore(this.resource.plural);
  }

  @Memoize()
  public toString(): string {
    return this.name;
  }

  public getEscapedName(alias?: string): string {
    return `${escapeId(this.name)}${alias && alias !== this.name ? ` AS ${escapeId(alias)}` : ''}`;
  }

  @Memoize()
  public getCharset(): string {
    return this.config.charset || this.database.connector.getCharset();
  }

  @Memoize()
  public getCollation(): string {
    return this.config.collation || this.database.connector.getCollation();
  }

  @Memoize(({ name }: Field) => name)
  public getColumn(field: Field): Column {
    this.resource.getFieldMap().assert(field);

    return new Column(this, field);
  }

  @Memoize(({ name }: Relation) => name)
  public getForeignKey(relation: Relation): ForeignKey {
    this.resource.getRelationMap().assert(relation);

    return new ForeignKey(this, relation);
  }

  @Memoize(({ name }: Component) => name)
  public getComponentColumnSet(component: Component): ColumnSet {
    this.resource.getComponentMap().assert(component);

    return new ColumnSet<Column | ColumnReference>(
      component instanceof Field ? [this.getColumn(component)] : this.getForeignKey(component).getColumnSet(),
    );
  }

  public getComponentSetColumnSet(componentSet: ComponentSet): ColumnSet {
    return new ColumnSet().concat(...[...componentSet].map(component => this.getComponentColumnSet(component)));
  }

  @Memoize()
  public getPrimaryKey(): PrimaryKey {
    return new PrimaryKey(this, this.resource.getIdentifier());
  }

  @Memoize()
  public getForeignKeySet(): ForeignKeySet {
    return new ForeignKeySet([...this.resource.getRelationSet()].map(relation => this.getForeignKey(relation)));
  }

  @Memoize()
  public getUniqueIndexSet(): UniqueIndexSet {
    const uniqueIndexSet = new UniqueIndexSet();
    for (const unique of this.resource.getUniqueSet()) {
      if (!unique.isIdentifier()) {
        uniqueIndexSet.add(new UniqueIndex(this, unique));
      }
    }

    return uniqueIndexSet;
  }

  @Memoize()
  public getColumnSet(): ColumnSet {
    return this.getComponentSetColumnSet(
      new ComponentSet().concat(
        // First, the primary key
        this.resource.getIdentifier().componentSet,

        // Then, the regular fields
        this.resource.getFieldSet(),

        // And finally, the regular relations
        this.resource.getRelationSet(),
      ),
    );
  }

  @Memoize()
  public getAutoIncrementColumn(): Column | ColumnReference | null {
    return this.getColumnSet().find(column => column.autoIncrement) || null;
  }

  public newSelectStatement(): SelectStatement {
    return new SelectStatement(this);
  }

  public newInsertStatement(): InsertStatement {
    return new InsertStatement(this);
  }

  public newUpdateStatement(): UpdateStatement {
    return new UpdateStatement(this);
  }

  public newDeleteStatement(): DeleteStatement {
    return new DeleteStatement(this);
  }

  @Memoize(id => id)
  public getOperation<TId extends OperationId, TConstructor extends OperationConstructor<TId>>(
    id: TId,
  ): InstanceType<TConstructor> {
    const constructor = operationMap[id] as TConstructor;
    if (!constructor) {
      throw new Error(
        `The operation "${id}" does not exist, please choose among "${Object.keys(operationMap).join(', ')}".`,
      );
    }

    return new constructor(this);
  }

  public getValue(node: NodeValue, column: Column | ColumnReference): FieldValue | undefined {
    return column.getValue(node);
  }
}
