import * as utils from '@prismamedia/graphql-platform-utils';
import * as R from 'remeda';
import { FixTableStatement } from '../../../statement.js';
import type { SchemaFix } from '../../diagnosis.js';
import type { Table } from '../../table.js';
import type { Column, ColumnDiagnosis } from '../column.js';
import type { TableDiagnosis } from '../diagnosis.js';
import type { ForeignKey, ForeignKeyDiagnosis } from '../foreign-key.js';
import type { Index, IndexDiagnosis } from '../index.js';

abstract class AbstractTableFix {
  public abstract readonly missingForeignKeys: ReadonlyArray<ForeignKey>;

  public constructor(
    public readonly parent: SchemaFix,
    public readonly table: Table,
  ) {}

  public get missingForeignKeyDependencies(): ReadonlyArray<TableFix> {
    return Array.from(
      new Set(
        R.pipe(
          this.missingForeignKeys,
          R.map((foreignKey) => {
            if (foreignKey.referencedTable !== this.table) {
              return (
                this.parent.missingTableFixes.find(
                  ({ table }) => foreignKey.referencedTable === table,
                ) ||
                this.parent.invalidTableFixes.find(
                  ({ table, missingColumns, invalidColumns }) =>
                    foreignKey.referencedTable === table &&
                    R.intersection(foreignKey.referencedTable.columns, [
                      ...missingColumns,
                      ...invalidColumns.map(({ column }) => column),
                    ]).length > 0,
                )
              );
            }
          }),
          R.filter(R.isDefined),
        ),
      ),
    );
  }

  public abstract execute(): Promise<void>;
}

export class MissingTableFix extends AbstractTableFix {
  public get missingForeignKeys(): ReadonlyArray<ForeignKey> {
    return R.pipe(
      this.table.foreignKeys,
      R.differenceWith(
        this.parent.untouchedMissingTables,
        (a, b) => a.referencedTable === b,
      ),
      R.differenceWith(
        this.parent.untouchedInvalidTables,
        (a, b) =>
          a.referencedTable === b.table &&
          R.intersection(a.referencedIndex.columns, b.missingColumns).length >
            0,
      ),
      R.differenceWith(
        this.parent.invalidTableFixes,
        (a, b) =>
          a.referencedTable === b.table &&
          R.intersection(a.referencedIndex.columns, b.untouchedMissingColumns)
            .length > 0,
      ),
    );
  }

  public override async execute(): Promise<void> {
    await this.table.create({ withForeignKeys: this.missingForeignKeys });
  }
}

export type InvalidTableFixOptions = {
  ignore?: boolean;

  comment?: boolean;
  engine?: boolean;
  collation?: boolean;

  foreignKeys?: boolean | ReadonlyArray<ForeignKey['name']>;
  indexes?: boolean | ReadonlyArray<Index['name']>;

  nullable?: boolean;
  columns?: boolean | ReadonlyArray<Column['name']>;
};

export class InvalidTableFix extends AbstractTableFix {
  public readonly ignore: boolean;

  public readonly comment: boolean;
  public readonly engine: boolean;
  public readonly collation: boolean;

  readonly #foreignKeys: ReadonlyArray<ForeignKey['name']>;
  readonly #indexes: ReadonlyArray<Index['name']>;
  readonly #columns: ReadonlyArray<Column['name']>;

  public readonly extraForeignKeys: ReadonlyArray<ForeignKey['name']>;
  public readonly invalidForeignKeys: ReadonlyArray<ForeignKeyDiagnosis>;

  public readonly extraIndexes: ReadonlyArray<Index['name']>;
  public readonly missingIndexes: ReadonlyArray<Index>;
  public readonly invalidIndexes: ReadonlyArray<IndexDiagnosis>;

  public readonly nullable: boolean;
  public readonly extraColumns: ReadonlyArray<Column['name']>;
  public readonly missingColumns: ReadonlyArray<Column>;
  public readonly untouchedMissingColumns: ReadonlyArray<Column>;
  public readonly invalidColumns: ReadonlyArray<ColumnDiagnosis>;

  public constructor(
    parent: SchemaFix,
    public readonly diagnosis: TableDiagnosis,
    options?: InvalidTableFixOptions,
  ) {
    super(parent, diagnosis.table);

    this.ignore = utils.getOptionalFlag(options?.ignore, false);

    this.comment = Boolean(
      diagnosis.commentError && utils.getOptionalFlag(options?.comment, true),
    );

    this.engine = Boolean(
      diagnosis.engineError && utils.getOptionalFlag(options?.engine, true),
    );

    this.collation = Boolean(
      (diagnosis.collationError ||
        diagnosis.invalidColumns.some(
          ({ collationError }) => collationError,
        )) &&
        utils.getOptionalFlag(options?.collation, true),
    );

    // foreign-keys
    {
      this.#foreignKeys =
        options?.foreignKeys == null || options.foreignKeys === true
          ? diagnosis.fixableForeignKeyNames
          : options.foreignKeys === false
            ? []
            : R.intersection(
                diagnosis.fixableForeignKeyNames,
                options.foreignKeys,
              );

      this.extraForeignKeys = R.intersection(
        diagnosis.extraForeignKeys,
        this.#foreignKeys,
      );

      this.invalidForeignKeys = R.pipe(
        diagnosis.invalidForeignKeys,
        R.intersectionWith(
          this.#foreignKeys,
          (a, b) => a.foreignKey.name === b,
        ),
      );
    }

    // indexes
    {
      this.#indexes =
        options?.indexes == null || options.indexes === true
          ? diagnosis.fixableIndexNames
          : options.indexes === false
            ? []
            : R.intersection(diagnosis.fixableIndexNames, options.indexes);

      this.extraIndexes = R.intersection(diagnosis.extraIndexes, this.#indexes);

      this.missingIndexes = R.intersectionWith(
        diagnosis.missingIndexes,
        this.#indexes,
        (a, b) => a.name === b,
      );

      this.invalidIndexes = R.intersectionWith(
        diagnosis.invalidIndexes,
        this.#indexes,
        (a, b) => a.index.name === b,
      );
    }

    // columns
    {
      this.nullable = utils.getOptionalFlag(options?.nullable, true);

      this.#columns =
        options?.columns == null || options.columns === true
          ? diagnosis.fixableColumnNames
          : options.columns === false
            ? []
            : R.intersection(diagnosis.fixableColumnNames, options.columns);

      this.extraColumns = R.intersection(diagnosis.extraColumns, this.#columns);

      this.missingColumns = R.intersectionWith(
        diagnosis.missingColumns,
        this.#columns,
        (a, b) => a.name === b,
      );

      this.untouchedMissingColumns = R.difference(
        diagnosis.missingColumns,
        this.missingColumns,
      );

      this.invalidColumns = R.intersectionWith(
        diagnosis.invalidColumns,
        this.#columns,
        (a, b) => a.column.name === b,
      );
    }
  }

  public get missingForeignKeys(): ReadonlyArray<ForeignKey> {
    return R.pipe(
      this.diagnosis.missingForeignKeys,
      R.intersectionWith(this.#foreignKeys, (a, b) => a.name === b),
      R.differenceWith(
        this.parent.untouchedMissingTables,
        (a, b) => a.referencedTable === b,
      ),
      R.differenceWith(
        this.parent.untouchedInvalidTables,
        (a, b) =>
          a.referencedTable === b.table &&
          R.intersection(a.referencedIndex.columns, b.missingColumns).length >
            0,
      ),
      R.differenceWith(
        this.parent.invalidTableFixes,
        (a, b) =>
          a.referencedTable === b.table &&
          R.intersection(a.referencedIndex.columns, b.untouchedMissingColumns)
            .length > 0,
      ),
    );
  }

  public override async execute(): Promise<void> {
    const connector = this.table.schema.connector;

    if (FixTableStatement.supports(this)) {
      await connector.executeStatement(new FixTableStatement(this));
    }
  }
}

export type TableFix = MissingTableFix | InvalidTableFix;
