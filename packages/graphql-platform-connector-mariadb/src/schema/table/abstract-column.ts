import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { Table } from '../table.js';
import type { DataType } from './data-type.js';

export abstract class AbstractColumn {
  public abstract readonly name: string;
  public abstract readonly description?: string;
  public abstract readonly dataType: DataType;
  public abstract readonly definition: string;

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

  public pickLeafValueFromRow(row: utils.PlainObject): core.LeafValue {
    return this.dataType.parseColumnValue(row[this.name]);
  }
}
