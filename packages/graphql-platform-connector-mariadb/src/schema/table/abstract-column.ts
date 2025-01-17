import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { Table } from '../table.js';
import type { DataType } from './data-type.js';

export abstract class AbstractColumn {
  public abstract readonly name: string;
  public abstract readonly comment?: string;
  public abstract readonly dataType: DataType;

  public constructor(
    public readonly table: Table,
    public readonly component: core.Component,
  ) {}

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @MGetter
  public get qualifiedName(): string {
    return `${this.table.name}.${this.name}`;
  }

  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  @MGetter
  public get fullyQualifiedName(): string {
    return `${this.table.qualifiedName}.${this.name}`;
  }

  public toString(): string {
    return this.fullyQualifiedName;
  }

  public abstract isAutoIncrement(): boolean;

  public abstract isNullable(): boolean;

  @MGetter
  public get constraint(): string | undefined {
    return this.dataType.kind === 'JSON'
      ? `JSON_VALID(${escapeIdentifier(this.name)})`
      : undefined;
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#column-definitions
   */
  public getDefinition(nullable: boolean): string {
    return [
      this.dataType.definition,
      this.isAutoIncrement() && 'AUTO_INCREMENT',
      nullable ? 'NULL' : 'NOT NULL',
      this.comment && `COMMENT ${escapeStringValue(this.comment)}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#column-definitions
   */
  @MGetter
  public get definition(): string {
    return this.getDefinition(this.isNullable());
  }

  public pickLeafValueFromRow(row: utils.PlainObject): core.LeafValue {
    return this.dataType.parseColumnValue(row[this.name]);
  }
}
