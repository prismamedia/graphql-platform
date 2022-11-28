import { Memoize } from '@prismamedia/memoize';
import type { Table } from '../table.js';

export abstract class AbstractIndex {
  public abstract readonly name: string;
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
}
