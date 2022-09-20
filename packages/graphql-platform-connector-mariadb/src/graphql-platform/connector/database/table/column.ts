import {
  FieldValue,
  GraphQLDate,
  GraphQLDateTime,
  GraphQLTime,
  InvalidComponentValueError,
  NodeValue,
  NullComponentValueError,
  UndefinedComponentValueError,
} from '@prismamedia/graphql-platform-core';
import {
  FlagConfig,
  getFlagValue,
  Maybe,
  MaybeUndefinedDecorator,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { isEnumType } from 'graphql';
import { escapeId } from 'mysql';
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
      type:
        | DataType.TEXT
        | DataType.MEDIUMTEXT
        | DataType.LONGTEXT
        | DataType.TINYTEXT;
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
      type:
        | DataType.BIGINT
        | DataType.INTEGER
        | DataType.MEDIUMINT
        | DataType.SMALLINT
        | DataType.TINYINT;
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

  /** Optional, will activate FullText search, default: 4 */
  fullText?: Maybe<number>;
}

export type ColumnValue = null | number | string;

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
    return typeof this.config.default === 'string'
      ? this.config.default
      : undefined;
  }

  @Memoize()
  public get fullText(): number | null {
    return typeof this.config.fullText === 'number' &&
      Number.isInteger(this.config.fullText) &&
      this.config.fullText > 0
      ? this.config.fullText
      : null;
  }

  public get comment(): string | undefined {
    return this.field.description;
  }

  public getValue(value: FieldValue): ColumnValue {
    if (typeof value === 'undefined') {
      throw new UndefinedComponentValueError(this.component);
    } else if (value === null) {
      if (!this.nullable) {
        throw new NullComponentValueError(this.component);
      }

      return null;
    } else {
      switch (this.field.getType().name) {
        case 'Boolean':
          if (typeof value !== 'boolean') {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a Boolean, received "${value}"`,
            );
          }

          return value ? 1 : 0;

        case 'DateTime':
          if (!(value instanceof Date)) {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a Date, received "${value}"`,
            );
          }

          return (
            value
              // Get the date as a string in UTC timezone (eg: 2018-04-21T05:01:06.295Z)
              .toISOString()
              // Remove the final 'Z' (eg: 2018-04-21T05:01:06.295)
              .slice(0, -1)
              // Remove the 'T' (eg: 2018-04-21 05:01:06.295)
              .replace('T', ' ')
          );

        case 'Date':
          if (!(value instanceof Date)) {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a Date, received "${value}"`,
            );
          }

          return (
            value
              // Get the date as a string in UTC timezone (eg: 2018-04-21T05:01:06.295Z)
              .toISOString()
              // Remove 'T', the time and the final 'Z' (eg: 2018-04-21)
              .slice(0, 10)
          );

        case 'Time':
          if (!(value instanceof Date)) {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a Date, received "${value}"`,
            );
          }

          return (
            value
              // Get the date as a string in UTC timezone (eg: 2018-04-21T05:01:06.295Z)
              .toISOString()
              // Remove the date, 'T' and the final 'Z' (eg: 05:01:06.295)
              .slice(11, -1)
          );

        default:
          if (!(typeof value === 'number' || typeof value === 'string')) {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a number or a string, received "${value}"`,
            );
          }

          return value;
      }
    }
  }

  public pickValue<TStrict extends boolean>(
    node: NodeValue,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<ColumnValue, TStrict> {
    const value = this.field.pickValue(node, strict);

    return (
      typeof value !== 'undefined'
        ? this.getValue(value as FieldValue)
        : undefined
    ) as any;
  }

  public setValue(node: POJO, value: ColumnValue): void {
    if (value === null) {
      this.field.setValue(node, value);
    } else {
      switch (this.field.getType().name) {
        case 'Boolean':
          if (typeof value !== 'number') {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a number, received "${value}"`,
            );
          }

          this.field.setValue(node, value === 1);
          break;

        case 'DateTime':
          if (typeof value !== 'string') {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a string, received "${value}"`,
            );
          }

          this.field.setValue(
            node,
            GraphQLDateTime.parseValue(`${value.split(' ').join('T')}Z`),
          );
          break;

        case 'Date':
          if (typeof value !== 'string') {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a string, received "${value}"`,
            );
          }

          this.field.setValue(node, GraphQLDate.parseValue(value));
          break;

        case 'Time':
          if (typeof value !== 'string') {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a string, received "${value}"`,
            );
          }

          this.field.setValue(node, GraphQLTime.parseValue(`${value}Z`));
          break;

        default:
          if (!(typeof value === 'number' || typeof value === 'string')) {
            throw new InvalidComponentValueError(
              this.field,
              `has to be a number or a string, received "${value}"`,
            );
          }

          this.field.setValue(node, value);
          break;
      }
    }
  }
}
