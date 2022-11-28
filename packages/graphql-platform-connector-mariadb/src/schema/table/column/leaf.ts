import type * as core from '@prismamedia/graphql-platform';
import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { URL } from 'node:url';
import * as semver from 'semver';
import type { Constructor, JsonArray, JsonObject } from 'type-fest';
import { escapeStringValue } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import type { Table } from '../../table.js';
import { AbstractColumn } from '../abstract-column.js';
import {
  BigIntType,
  BooleanType,
  CharType,
  createDataTypeFromConfig,
  DateTimeType,
  DateType,
  DoubleType,
  EnumType,
  IntType,
  JsonType,
  TextType,
  UuidType,
  VarCharType,
  type DataType,
  type DataTypeConfig,
} from '../data-type.js';
import { FullTextIndex } from '../index/full-text.js';

export const forbiddenReferenceDataTypeConstructors: ReadonlyArray<
  Constructor<DataType>
> = [TextType] as const;

export interface LeafColumnConfig {
  /**
   * Optional, the column's name
   *
   * Default: the leaf's name
   */
  name?: utils.Nillable<string>;

  /**
   * Optional, fine-tune the column's data-type
   *
   * Default: guessed from the leaf's definition
   */
  dataType?: utils.Nillable<DataTypeConfig>;

  /**
   * Optional, either this column is auto-increment or not
   *
   * Default: false
   */
  autoIncrement?: utils.OptionalFlag;

  /**
   * Optional, either this column has a full-text index or not
   *
   * Default: false
   */
  fullTextIndex?: utils.OptionalFlag;
}

export class LeafColumn extends AbstractColumn {
  public readonly config?: LeafColumnConfig;
  public readonly configPath: utils.Path;

  public readonly name: string;
  public readonly description?: string;
  public readonly dataType: DataType;
  public readonly fullTextIndex?: FullTextIndex;

  public constructor(
    table: Table,
    public readonly leaf: core.Leaf<any, MariaDBConnector>,
  ) {
    super(table);

    // config
    {
      this.config = leaf.config.column;
      this.configPath = utils.addPath(leaf.configPath, 'column');

      utils.assertNillablePlainObjectConfig(this.config, this.configPath);
    }

    // name
    {
      const nameConfig = this.config?.name;
      const nameConfigPath = utils.addPath(this.configPath, 'name');

      if (nameConfig) {
        if (typeof nameConfig !== 'string') {
          throw new utils.UnexpectedConfigError('a string', nameConfig, {
            path: nameConfigPath,
          });
        }

        if (nameConfig.startsWith('_')) {
          throw new utils.UnexpectedConfigError(
            `not to start with "_"`,
            nameConfig,
            { path: nameConfigPath },
          );
        }

        // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
        if (nameConfig.length > 64) {
          throw new utils.UnexpectedConfigError(
            'an identifier shorter than 64 characters',
            nameConfig,
            { path: nameConfigPath },
          );
        }

        this.name = nameConfig;
      } else {
        if (leaf.name.startsWith('_')) {
          throw new utils.UnexpectedConfigError(
            `to be provided as the leaf's name starts with "_"`,
            nameConfig,
            { path: nameConfigPath },
          );
        }

        this.name = table.schema.namingStrategy.getLeafColumnName(
          table.name,
          leaf,
        );
      }
    }

    // description
    {
      this.description = leaf.description;
    }

    // data-type
    {
      const dataTypeConfig = this.config?.dataType;
      const dataTypeConfigPath = utils.addPath(this.configPath, 'dataType');

      if (dataTypeConfig) {
        this.dataType = createDataTypeFromConfig(
          dataTypeConfig,
          dataTypeConfigPath,
        );
      } else if (graphql.isEnumType(leaf.type)) {
        this.dataType = new EnumType<string>({
          values: leaf.type.getValues().map(({ value }) => value),
        });
      } else {
        const leafTypeName = leaf.type.name as scalars.TypeName;
        switch (leafTypeName) {
          case 'Boolean':
            this.dataType = new BooleanType<boolean>();
            break;

          case 'BigInt':
          case 'UnsignedBigInt':
            this.dataType = new BigIntType<bigint>({
              modifiers:
                leafTypeName === 'UnsignedBigInt' ? ['UNSIGNED'] : undefined,
            });
            break;

          case 'Int':
          case 'UnsignedInt':
            this.dataType = new IntType<number>({
              modifiers:
                leafTypeName === 'UnsignedInt' ? ['UNSIGNED'] : undefined,
            });
            break;

          case 'Float':
          case 'UnsignedFloat':
            this.dataType = new DoubleType<number>({
              modifiers:
                leafTypeName === 'UnsignedFloat' ? ['UNSIGNED'] : undefined,
              scale: 2,
            });
            break;

          case 'EmailAddress':
          case 'ID':
          case 'NonEmptyString':
          case 'NonEmptyTrimmedString':
          case 'String':
            this.dataType = new VarCharType<string>({
              length: 255,
              charset: this.table.defaultCharset,
              collation: this.table.defaultCollation,
            });
            break;

          case 'UUID':
          case 'UUIDv1':
          case 'UUIDv2':
          case 'UUIDv3':
          case 'UUIDv4':
          case 'UUIDv5':
            this.dataType =
              this.table.schema.connector.version &&
              semver.gte(this.table.schema.connector.version, '10.7.0')
                ? new UuidType<string>()
                : new CharType<string>({
                    length: 36,
                    charset: this.table.defaultCharset,
                    collation: this.table.defaultCollation,
                  });
            break;

          case 'Date':
            this.dataType = new DateType<Date>();
            break;

          case 'DateTime':
            this.dataType = new DateTimeType<Date>({ microsecondPrecision: 3 });
            break;

          case 'URL':
            this.dataType = new VarCharType<URL>({
              length: 255,
              charset: this.table.defaultCharset,
              collation: this.table.defaultCollation,
              parser: (value) => scalars.parseURL(value),
              serializer: (value) => value.toString(),
            });
            break;

          case 'DraftJS':
            this.dataType = new JsonType<scalars.RawDraftContentState>();
            break;

          case 'JSONObject':
            this.dataType = new JsonType<JsonObject>();
            break;

          case 'JSONArray':
            this.dataType = new TextType<JsonArray>({
              charset: this.table.defaultCharset,
              collation: this.table.defaultCollation,
              parser: (value) => JSON.parse(value),
              serializer: (value) => JSON.stringify(value),
            });
            break;

          default:
            throw new utils.UnreachableValueError(leafTypeName);
        }
      }

      if (
        leaf.referrerSet.size > 0 &&
        forbiddenReferenceDataTypeConstructors.some(
          (constructor) => this.dataType instanceof constructor,
        )
      ) {
        throw new utils.UnexpectedConfigError(
          `a "referenceable" data-type as the column has referrer(s)`,
          dataTypeConfig,
          { path: dataTypeConfigPath },
        );
      }
    }

    // full-text-index
    {
      const fullTextIndexConfig = this.config?.fullTextIndex;
      const fullTextIndexConfigPath = utils.addPath(
        this.configPath,
        'fullTextIndex',
      );

      if (
        utils.getOptionalFlag(
          fullTextIndexConfig,
          false,
          fullTextIndexConfigPath,
        )
      ) {
        if (
          ![CharType, JsonType, TextType, VarCharType].some(
            (constructor) => this.dataType instanceof constructor,
          )
        ) {
          throw new utils.UnexpectedConfigError(
            `not to be true as the "${this.dataType.kind}" data-type does not support it`,
            fullTextIndexConfig,
            { path: fullTextIndexConfigPath },
          );
        }

        this.fullTextIndex = new FullTextIndex(table, [this]);
      }
    }
  }

  @Memoize()
  public isAutoIncrement(): boolean {
    const autoIncrementConfig = this.config?.autoIncrement;
    const autoIncrementConfigPath = utils.addPath(
      this.configPath,
      'autoIncrement',
    );

    const isAutoIncrement = utils.getOptionalFlag(
      autoIncrementConfig,
      false,
      autoIncrementConfigPath,
    );

    if (isAutoIncrement && !this.leaf.isIdentifier()) {
      throw new utils.UnexpectedConfigError(
        `not to be true as "${this.leaf}" is not the identifier`,
        autoIncrementConfig,
        { path: autoIncrementConfigPath },
      );
    }

    return isAutoIncrement;
  }

  @Memoize()
  public isNullable(): boolean {
    return this.leaf.isNullable();
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#column-definitions
   */
  @Memoize()
  public get definition(): string {
    return [
      this.dataType.definition,
      this.isAutoIncrement() && 'AUTO_INCREMENT',
      this.isNullable() ? 'NULL' : 'NOT NULL',
      this.description &&
        `COMMENT ${escapeStringValue(this.description.substring(0, 1024))}`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
