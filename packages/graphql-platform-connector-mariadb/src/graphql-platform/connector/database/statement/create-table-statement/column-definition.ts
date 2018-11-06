import { escape } from 'mysql';
import { Column } from '../../table/column';
import { ColumnReference } from '../../table/column-reference';

export class ColumnDefinition {
  public constructor(readonly column: Column | ColumnReference) {}

  public toString(): string {
    return [
      this.column.getEscapedName(),
      [
        [
          this.column.dataType.type,
          'length' in this.column.dataType && typeof this.column.dataType.length === 'number'
            ? `(${[
                this.column.dataType.length,
                'decimals' in this.column.dataType && typeof this.column.dataType.decimals === 'number'
                  ? this.column.dataType.decimals
                  : null,
              ]
                .filter(Boolean)
                .join(',')})`
            : null,
          'values' in this.column.dataType && Array.isArray(this.column.dataType.values)
            ? `(${this.column.dataType.values.map(value => escape(value)).join(',')})`
            : null,
          'microsecondPrecision' in this.column.dataType &&
          typeof this.column.dataType.microsecondPrecision === 'number'
            ? `(${this.column.dataType.microsecondPrecision})`
            : null,
        ]
          .filter(Boolean)
          .join(''),
        ...('modifiers' in this.column.dataType && Array.isArray(this.column.dataType.modifiers)
          ? this.column.dataType.modifiers
          : []),
      ]
        .filter(Boolean)
        .join(' '),
      this.column.nullable ? 'NULL' : 'NOT NULL',
      this.column.default != null ? `DEFAULT ${this.column.default}` : null,
      this.column.autoIncrement ? 'AUTO_INCREMENT' : null,
      this.column.comment ? `COMMENT ${escape(this.column.comment.substring(0, 255))}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
