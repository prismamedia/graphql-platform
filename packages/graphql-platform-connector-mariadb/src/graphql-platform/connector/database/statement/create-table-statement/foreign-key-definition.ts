import { ForeignKey } from '../../table/foreign-key';

export class ForeignKeyDefinition {
  public constructor(readonly foreignKey: ForeignKey) {}

  public toString(): string {
    return `FOREIGN KEY ${this.foreignKey.getEscapedName() ||
      ''} (${this.foreignKey
      .getColumnSet()
      .getEscapedNames()}) REFERENCES ${this.foreignKey.getTo().getEscapedName()} (${[...this.foreignKey.getColumnSet()]
      .map(column => column.reference.getEscapedName())
      .join(', ')}) ON UPDATE ${this.foreignKey.onUpdate} ON DELETE ${this.foreignKey.onDelete}`;
  }
}
