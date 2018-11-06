import { PrimaryKey } from '../../table/primary-key';

export class PrimaryKeyDefinition {
  public constructor(readonly primaryKey: PrimaryKey) {}

  public toString(): string {
    return `PRIMARY KEY (${this.primaryKey.getColumnSet().getEscapedNames()})`;
  }
}
