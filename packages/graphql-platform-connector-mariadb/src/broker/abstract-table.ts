import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { MariaDBBroker } from '../broker.js';
import { escapeIdentifier, escapeStringValue } from '../escaping.js';
import type { MariaDBConnector, PoolConnection } from '../index.js';
import type { DataType, Schema } from '../schema.js';
import * as schema from '../schema.js';
import { StatementKind } from '../statement.js';

export interface ColumnConfig {
  dataType: DataType;
  autoIncrement?: boolean;
  nullable?: boolean;
  comment?: string;
}

export class Column<TTable extends AbstractTable = any> {
  public readonly qualifiedName: string;
  public readonly fullyQualifiedName: string;
  public readonly dataType: DataType;
  public readonly autoIncrement: boolean;
  public readonly nullable: boolean;
  public readonly comment?: string;

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
    this.comment = config.comment?.substring(0, 1024) || undefined;
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
      ReadonlyArray<[source: Column['name'], target: Column | schema.Column]>
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

    foreignKeys?.forEach((references) =>
      references.forEach(([source, _target]) =>
        assert(this.columnsByName.has(source)),
      ),
    );
  }

  public toString(): string {
    return this.qualifiedName;
  }

  public getColumnByName(name: Column['name']): Column<this> {
    const column = this.columnsByName.get(name);
    assert(column, `Column ${name} not found in table ${this.qualifiedName}`);

    return column;
  }

  public escapeColumnIdentifier(name: Column['name'], alias?: string): string {
    return escapeIdentifier(
      [alias, this.getColumnByName(name).name].filter(Boolean).join('.'),
    );
  }

  public serializeColumnValue(name: Column['name'], value: any): string {
    return this.getColumnByName(name).dataType.serialize(value);
  }

  public async setup(
    connection: PoolConnection<StatementKind.DATA_DEFINITION>,
    options?: {
      orReplace?: utils.OptionalFlag;
      ifNotExists?: utils.OptionalFlag;
    },
  ): Promise<void> {
    const orReplace = utils.getOptionalFlag(options?.orReplace, true);
    const ifNotExists = utils.getOptionalFlag(options?.ifNotExists, !orReplace);

    await connection.query(`
      ${[
        'CREATE',
        orReplace && 'OR REPLACE',
        'TABLE',
        ifNotExists && 'IF NOT EXISTS',
        escapeIdentifier(this.qualifiedName),
      ]
        .filter(Boolean)
        .join(' ')} (${[
        ...this.columnsByName
          .values()
          .map(
            (column) =>
              `${escapeIdentifier(column.name)} ${[
                column.dataType.definition,
                column.autoIncrement && 'AUTO_INCREMENT',
                column.nullable && 'NULL',
                column.comment &&
                  `COMMENT ${escapeStringValue(column.comment)}`,
              ]
                .filter(Boolean)
                .join(' ')}`,
          ),
        `PRIMARY KEY (${this.primary.map(escapeIdentifier).join(',')})`,
        ...(this.indexes?.map(
          (columns) =>
            `INDEX ${escapeIdentifier(`idx_${columns.join('_')}`.replace(/_+/g, '_'))} (${columns.map(escapeIdentifier).join(', ')})`,
        ) ?? []),
        ...(this.foreignKeys?.map(
          (references) =>
            `FOREIGN KEY ${escapeIdentifier(
              `fk_${this.name}_${references
                .map(([source]) => source)
                .join('_')}`.replace(/_+/g, '_'),
            )} (${references.map(([source]) => escapeIdentifier(source)).join()}) REFERENCES ${escapeIdentifier(references[0][1].table.qualifiedName)} (${references.map(([, target]) => escapeIdentifier(target.name)).join()}) ON DELETE CASCADE`,
        ) ?? []),
      ].join(`, `)})
      ENGINE = ${escapeStringValue('InnoDB')}
      DEFAULT CHARSET = ${escapeStringValue(this.schema.defaultCharset)}
      DEFAULT COLLATE = ${escapeStringValue(this.schema.defaultCollation)}
    `);
  }
}
