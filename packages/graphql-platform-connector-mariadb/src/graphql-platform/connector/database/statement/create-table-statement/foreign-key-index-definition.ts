import { ForeignKey } from '../../table/foreign-key';

export class ForeignKeyIndexDefinition {
  public constructor(readonly foreignKey: ForeignKey) {}

  public toString(): string {
    return `INDEX ${this.foreignKey.getEscapedName() || ''} (${this.foreignKey.getColumnSet().getEscapedNames()})`;
  }
}
