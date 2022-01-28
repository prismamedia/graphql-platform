import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { escapeStringValue } from '../../escape.js';
import type { Table } from '../table.js';
import type { DataType } from './data-type.js';

export abstract class AbstractColumn {
  public abstract readonly name: string;
  public abstract readonly description?: string;
  public abstract readonly dataType: DataType;
  public abstract isAutoIncrement(): boolean;
  public abstract isNullable(): boolean;

  public constructor(public readonly table: Table) {}

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @Memoize()
  public get qualifiedName(): string {
    return `${this.table.name}.${this.name}`;
  }

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @Memoize()
  public get fullyQualifiedName(): string {
    return `${this.table.qualifiedName}.${this.name}`;
  }

  public toString(): string {
    return this.fullyQualifiedName;
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#column-definitions
   */
  @Memoize()
  public get definition(): string {
    return [
      this.dataType.definition,
      this.isAutoIncrement() && 'AUTO_INCREMENT',
      !this.isNullable() && 'NOT NULL',
      this.description &&
        `COMMENT ${escapeStringValue(this.description.substring(0, 1024))}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  public pickLeafValueFromRow(row: utils.PlainObject): core.LeafValue {
    return this.dataType.fromColumnValue(row[this.name]);
  }
}
