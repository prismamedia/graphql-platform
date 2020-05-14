import { Memoize } from '@prismamedia/ts-memoize';
import { escape, QueryOptions } from 'mysql';
import { Table } from '../table';
import { ColumnDefinition } from './create-table-statement/column-definition';
import { ColumnIndexDefinition } from './create-table-statement/column-index-definition';
import { ForeignKeyDefinition } from './create-table-statement/foreign-key-definition';
import { ForeignKeyIndexDefinition } from './create-table-statement/foreign-key-index-definition';
import { PrimaryKeyDefinition } from './create-table-statement/primary-key-definition';
import { UniqueIndexDefinition } from './create-table-statement/unique-index-definition';

export class CreateTableStatement implements QueryOptions {
  public constructor(readonly table: Table) {}

  public get createDefinition(): string {
    return [
      ...[...this.table.getColumnSet()].map(
        (column) => new ColumnDefinition(column),
      ),
      new PrimaryKeyDefinition(this.table.getPrimaryKey()),
      ...[...this.table.getUniqueIndexSet()].map(
        (uniqueIndex) => new UniqueIndexDefinition(uniqueIndex),
      ),
      ...[...this.table.getColumnIndexSet()].map(
        (columnIndex) => new ColumnIndexDefinition(columnIndex),
      ),
      ...[...this.table.getForeignKeySet()].map(
        (foreignKey) => new ForeignKeyIndexDefinition(foreignKey),
      ),
      ...[...this.table.getForeignKeySet()].map(
        (foreignKey) => new ForeignKeyDefinition(foreignKey),
      ),
    ]
      .filter(Boolean)
      .join(',');
  }

  public get tableOptions(): string {
    const options = {
      ENGINE: 'InnoDB',
      CHARSET: this.table.getCharset(),
      COLLATE: this.table.getCollation(),
      COMMENT:
        (this.table.resource.description &&
          this.table.resource.description.substring(0, 60)) ||
        null,
    };

    return Object.entries(options)
      .filter(([, value]) => Boolean(value))
      .map(([name, value]) => `${name}=${escape(value)}`)
      .join(',');
  }

  @Memoize()
  public get sql(): string {
    return `CREATE TABLE ${this.table.getEscapedName()} (${
      this.createDefinition
    }) ${this.tableOptions};`;
  }
}
