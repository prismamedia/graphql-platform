import { escapeId } from 'mysql';
import { UniqueIndex } from '../../table/unique-index';

export class UniqueIndexDefinition {
  public constructor(readonly uniqueIndex: UniqueIndex) {}

  public toString(): string {
    return `UNIQUE ${escapeId(this.uniqueIndex.name)} (${this.uniqueIndex
      .getColumnSet()
      .getEscapedNames()})`;
  }
}
