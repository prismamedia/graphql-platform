import { escapeId } from 'mysql';
import { ColumnIndex, ColumnIndexKind } from '../../table/column-index';

export class ColumnIndexDefinition {
  public constructor(readonly columnIndex: ColumnIndex) {}

  public toString(): string {
    let kind: string | undefined;
    switch (this.columnIndex.kind) {
      case ColumnIndexKind.Plain:
        // Default
        break;

      case ColumnIndexKind.FullText:
        kind = 'FULLTEXT';
        break;

      case ColumnIndexKind.Spatial:
        kind = 'SPATIAL';
        break;

      default:
        throw new Error(
          `The column index's kind "${this.columnIndex.kind}" is not supported, yet`,
        );
    }

    return [
      kind,
      'INDEX',
      escapeId(this.columnIndex.name),
      `(${this.columnIndex.getColumnSet().getEscapedNames()})`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
