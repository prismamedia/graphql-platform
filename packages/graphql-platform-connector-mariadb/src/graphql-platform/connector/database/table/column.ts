import {
  FlagConfig,
  getFlagValue,
  isScalar,
  Maybe,
  MaybeUndefinedDecorator,
  POJO,
  Scalar,
} from '@prismamedia/graphql-platform-utils';
import { isEnumType } from 'graphql';
import { escapeId } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Component, Field } from '../../../resource';
import { Table } from '../table';

export * from './column/set';

export enum DataType {
  BIGINT = 'BIGINT',
  BINARY = 'BINARY',
  BIT = 'BIT',
  BLOB = 'BLOB',
  BOOLEAN = 'BOOLEAN',
  CHAR = 'CHAR',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  DECIMAL = 'DECIMAL',
  DOUBLE = 'DOUBLE',
  ENUM = 'ENUM',
  FLOAT = 'FLOAT',
  INTEGER = 'INTEGER',
  JSON = 'JSON',
  LONGBLOB = 'LONGBLOB',
  LONGTEXT = 'LONGTEXT',
  MEDIUMBLOB = 'MEDIUMBLOB',
  MEDIUMINT = 'MEDIUMINT',
  MEDIUMTEXT = 'MEDIUMTEXT',
  SMALLINT = 'SMALLINT',
  TEXT = 'TEXT',
  TIME = 'TIME',
  TIMESTAMP = 'TIMESTAMP',
  TINYBLOB = 'TINYBLOB',
  TINYINT = 'TINYINT',
  TINYTEXT = 'TINYTEXT',
  VARBINARY = 'VARBINARY',
  VARCHAR = 'VARCHAR',
}

export enum NumericDataTypeModifier {
  SIGNED = 'SIGNED',
  UNSIGNED = 'UNSIGNED',
  ZEROFILL = 'ZEROFILL',
}

export type ColumnDataTypeWithOptions =
  | {
      type: DataType.ENUM;
      values: string[];
    }
  | {
      type: DataType.TEXT | DataType.MEDIUMTEXT | DataType.LONGTEXT | DataType.TINYTEXT;
      length?: Maybe<number>;
    }
  | {
      type: DataType.CHAR | DataType.VARCHAR;
      length: number;
    }
  | {
      type: DataType.BIT;
      length?: number;
    }
  | {
      type: DataType.BIGINT | DataType.INTEGER | DataType.MEDIUMINT | DataType.SMALLINT | DataType.TINYINT;
      modifiers?: Maybe<NumericDataTypeModifier[]>;
      length?: number;
    }
  | {
      type: DataType.DECIMAL | DataType.FLOAT;
      modifiers?: Maybe<NumericDataTypeModifier[]>;
      length?: Maybe<number>;
      decimals?: Maybe<number>;
    }
  | {
      type: DataType.DATETIME | DataType.TIME | DataType.TIMESTAMP;
      microsecondPrecision?: Maybe<number>;
    };

export type ColumnDataType =
  | ColumnDataTypeWithOptions
  | {
      type: Exclude<DataType, ColumnDataTypeWithOptions['type']>;
    };

export interface ColumnConfig {
  /** Optional, the column's name, default: field's name */
  name?: Maybe<string>;

  /** Optional, fine-tune the column's data type, default: guessed from the field's definition */
  dataType?: Maybe<ColumnDataType>;

  /** Optional, either this column is auto increment or not, default: false */
  autoIncrement?: FlagConfig;

  /** Optional, either this column has a default value or not, default: NULL */
  default?: Maybe<string>;
}

export type ColumnValue = null | Scalar | Date;

export function isColumnValue(value: unknown, nullable: boolean = true): value is ColumnValue {
  return value === null ? nullable : isScalar(value) || value instanceof Date;
}

export class Column {
  readonly component: Component;

  public constructor(readonly table: Table, readonly field: Field) {
    this.component = field;
  }

  public get config(): ColumnConfig {
    return this.field.config.column || {};
  }

  @Memoize()
  public get name(): string {
    return (
      (this.config.name || this.field.name)
        // cf: https://dev.mysql.com/doc/refman/8.0/en/identifiers.html
        .substr(0, 64)
    );
  }

  @Memoize()
  public toString(): string {
    return `${this.table}.${this.name}`;
  }

  public getEscapedName(alias?: string): string {
    return `${alias ? `${escapeId(alias)}.` : ''}${escapeId(this.name)}`;
  }

  @Memoize()
  public get dataType(): ColumnDataType {
    // Either it's defined by the user
    if (this.config.dataType) {
      return this.config.dataType;
    }

    // or we guess it from the field's type
    const fieldType = this.field.getType();

    if (isEnumType(fieldType)) {
      return {
        type: DataType.ENUM,
        values: fieldType.getValues().map(({ value }) => value),
      };
    }

    switch (fieldType.name) {
      case 'Boolean':
        return {
          type: DataType.BOOLEAN,
        };

      case 'Date':
        return {
          type: DataType.DATE,
        };

      case 'DateTime':
        return {
          type: DataType.TIMESTAMP,
        };

      case 'Float':
        return {
          type: DataType.FLOAT,
        };

      case 'ID':
        return {
          type: DataType.CHAR,
          length: 36,
        };

      case 'Int':
        return {
          type: DataType.INTEGER,
        };

      case 'String':
        return {
          type: DataType.VARCHAR,
          length: 255,
        };

      case 'Time':
        return {
          type: DataType.TIME,
        };

      default:
        throw new Error(
          `We were not able to guess the "${this.field}"'s column type, you have to define it by yourself.`,
        );
    }
  }

  @Memoize()
  public get autoIncrement(): boolean {
    return getFlagValue(this.config.autoIncrement, false);
  }

  public get nullable(): boolean {
    return this.field.isNullable();
  }

  @Memoize()
  public get default(): string | undefined {
    return typeof this.config.default === 'string' ? this.config.default : undefined;
  }

  public get comment(): string | undefined {
    return this.field.description;
  }

  /**
   * Get the corresponding column's value from the GraphQL field's value
   */
  public getValue<TStrict extends boolean>(node: POJO, strict: TStrict): MaybeUndefinedDecorator<ColumnValue, TStrict> {
    return this.field.getValue(node, strict);
  }

  /**
   * Set the corresponding the GraphQL field's value from the column's value
   */
  public setValue(node: POJO, value: ColumnValue | undefined): void {
    return this.field.setValue(node, value);
  }
}
