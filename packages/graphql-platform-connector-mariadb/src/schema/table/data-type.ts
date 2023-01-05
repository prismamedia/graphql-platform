import * as utils from '@prismamedia/graphql-platform-utils';
import {
  DateTimeType,
  DateType,
  TimestampType,
  type DateAndTimeDataType,
  type DateAndTimeDataTypeConfig,
} from './data-type/date-and-time.js';
import {
  BigIntType,
  BooleanType,
  DecimalType,
  DoubleType,
  FloatType,
  IntType,
  type NumericDataType,
  type NumericDataTypeConfig,
} from './data-type/numeric.js';
import {
  CharType,
  EnumType,
  JsonType,
  TextType,
  UuidType,
  VarCharType,
  type StringDataType,
  type StringDataTypeConfig,
} from './data-type/string.js';

export * from './data-type/date-and-time.js';
export * from './data-type/numeric.js';
export * from './data-type/string.js';

export type DataTypeConfig =
  | NumericDataTypeConfig
  | StringDataTypeConfig
  | DateAndTimeDataTypeConfig;

export type DataType = NumericDataType | StringDataType | DateAndTimeDataType;

export function createDataTypeFromConfig(
  config: DataTypeConfig,
  configPath: utils.Path,
): DataType {
  utils.assertPlainObjectConfig(config, configPath);

  switch (config.kind) {
    /**
     * Numeric
     *
     * @see https://mariadb.com/kb/en/data-types-numeric-data-types/
     */

    case 'BIGINT':
    // synonyms
    case 'INT8':
      return new BigIntType(config, configPath);

    case 'BOOLEAN':
    // synonyms
    case 'BOOL':
      return new BooleanType(config, configPath);

    case 'DECIMAL':
    // synonyms
    case 'DEC':
    case 'FIXED':
    case 'NUMERIC':
      return new DecimalType(config, configPath);

    case 'DOUBLE':
    // synonyms
    case 'DOUBLE PRECISION':
    case 'REAL':
      return new DoubleType(config, configPath);

    case 'FLOAT':
      return new FloatType(config, configPath);

    case 'INT':
    case 'MEDIUMINT':
    case 'SMALLINT':
    case 'TINYINT':
    // synonyms
    case 'INT1':
    case 'INT2':
    case 'INT3':
    case 'INT4':
      return new IntType(config, configPath);

    /**
     * String
     *
     * @see https://mariadb.com/kb/en/string-data-types/
     */

    case 'CHAR':
      return new CharType(config, configPath);

    case 'ENUM':
      return new EnumType(config, configPath);

    case 'JSON':
      return new JsonType(config, configPath);

    case 'LONGTEXT':
    case 'MEDIUMTEXT':
    case 'TEXT':
    case 'TINYTEXT':
    // synonyms
    case 'LONG VARCHAR':
    case 'LONG':
      return new TextType(config, configPath);

    case 'UUID':
      return new UuidType(config, configPath);

    case 'VARCHAR':
      return new VarCharType(config, configPath);

    /**
     * Date and time
     *
     * @see https://mariadb.com/kb/en/date-and-time-data-types/
     */

    case 'DATE':
      return new DateType(config, configPath);

    case 'DATETIME':
      return new DateTimeType(config, configPath);

    case 'TIMESTAMP':
      return new TimestampType(config, configPath);

    default:
      throw new utils.UnreachableValueError(config, { path: configPath });
  }
}
