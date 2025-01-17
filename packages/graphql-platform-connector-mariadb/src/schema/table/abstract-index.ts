import { MGetter, MMethod } from '@prismamedia/memoize';
import type { Table } from '../table.js';
import type { Column } from './column.js';

export abstract class AbstractIndex {
  public abstract readonly name: string;
  public abstract readonly columns: ReadonlyArray<Column>;
  public abstract readonly definition: string;

  public constructor(public readonly table: Table) {}

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

  @MMethod()
  public toString(): string {
    return this.fullyQualifiedName;
  }
}
