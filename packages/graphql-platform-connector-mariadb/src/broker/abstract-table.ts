import assert from 'node:assert';
import type { MariaDBBroker } from '../broker.js';
import { escapeIdentifier, escapeStringValue } from '../escaping.js';
import type { MariaDBConnector, PoolConnection } from '../index.js';
import type { DataType, Schema } from '../schema.js';
import { StatementKind } from '../statement.js';

export interface ColumnConfig {
  dataType: DataType;
  autoIncrement?: boolean;
  nullable?: boolean;
}

export class Column<TTable extends AbstractTable = any> {
  public readonly qualifiedName: string;
  public readonly fullyQualifiedName: string;
  public readonly dataType: DataType;
  public readonly autoIncrement: boolean;
  public readonly nullable: boolean;

  public constructor(
    public readonly table: TTable,
    public readonly name: string,
    public readonly config: ColumnConfig,
  ) {
    this.qualifiedName = `${table.name}.${name}`;
    this.fullyQualifiedName = `${table.qualifiedName}.${name}`;
    this.dataType = config.dataType;
    this.autoIncrement = config.autoIncrement ?? false;
    this.nullable = config.nullable ?? false;
  }
}

export abstract class AbstractTable {
  public readonly connector: MariaDBConnector;
  public readonly schema: Schema;
  public readonly qualifiedName: string;

  public readonly columnsByName: ReadonlyMap<Column['name'], Column<this>>;

  public constructor(
    public readonly broker: MariaDBBroker,
    public readonly name: string,
    columns: Record<Column['name'], ColumnConfig>,
    public readonly primary: ReadonlyArray<Column['name']>,
    public readonly indexes?: ReadonlyArray<ReadonlyArray<Column['name']>>,
    public readonly foreignKeys?: ReadonlyArray<
      [source: Column['name'], reference: Column]
    >,
  ) {
    this.connector = broker.connector;
    this.schema = this.connector.schema;
    this.qualifiedName = `${this.schema.name}.${name}`;

    this.columnsByName = new Map(
      Object.entries(columns).map(([name, config]) => [
        name,
        new Column(this, name, config),
      ]),
    );

    primary.forEach((column) => assert(this.columnsByName.has(column)));

    indexes?.forEach((index) =>
      index.forEach((column) => assert(this.columnsByName.has(column))),
    );

    foreignKeys?.forEach(([source, reference]) => {
      assert(this.columnsByName.has(source));
      assert(reference instanceof Column);
    });
  }

  public toString(): string {
    return this.qualifiedName;
  }

  public getColumnByName(name: Column['name']): Column<this> {
    const column = this.columnsByName.get(name);
    assert(column, `Column ${name} not found in table ${this.qualifiedName}`);

    return column;
  }

  public async setup(
    connection: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await connection.query(`
      CREATE OR REPLACE TABLE ${escapeIdentifier(this.qualifiedName)} (${[
        ...this.columnsByName
          .values()
          .map(
            (column) =>
              `${escapeIdentifier(column.name)} ${[
                column.dataType.definition,
                column.autoIncrement && 'AUTO_INCREMENT',
                column.nullable && 'NULL',
              ]
                .filter(Boolean)
                .join(' ')}`,
          ),
        `PRIMARY KEY (${this.primary.map(escapeIdentifier).join(',')})`,
        ...(this.indexes?.map(
          (columns) =>
            `INDEX ${escapeIdentifier(`idx_${columns.join('_')}`)} (${columns.map(escapeIdentifier).join(', ')})`,
        ) ?? []),
        ...(this.foreignKeys?.map(
          ([source, reference]) =>
            `FOREIGN KEY ${escapeIdentifier(`fk_${this.name}_${source}`)} (${escapeIdentifier(source)}) REFERENCES ${escapeIdentifier(reference.table.qualifiedName)} (${escapeIdentifier(reference.name)}) ON DELETE CASCADE`,
        ) ?? []),
      ].join(`, `)})
      ENGINE = ${escapeStringValue('InnoDB')}
      DEFAULT CHARSET = ${escapeStringValue(this.schema.defaultCharset)}
      DEFAULT COLLATE = ${escapeStringValue(this.schema.defaultCollation)}
    `);
  }
}
