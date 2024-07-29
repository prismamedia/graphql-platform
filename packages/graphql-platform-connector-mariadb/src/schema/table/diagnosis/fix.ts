import * as utils from '@prismamedia/graphql-platform-utils';
import * as R from 'remeda';
import {
  FixTableStatement,
  FixTableStatementStep,
} from '../../../statement.js';
import type { SchemaFix } from '../../diagnosis.js';
import type { Table } from '../../table.js';
import type { Column, ColumnDiagnosis } from '../column.js';
import type { TableDiagnosis } from '../diagnosis.js';
import type { ForeignKey, ForeignKeyDiagnosis } from '../foreign-key.js';
import type { Index, IndexDiagnosis } from '../index.js';

abstract class AbstractTableFix {
  public abstract readonly missingForeignKeys: ReadonlyArray<ForeignKey>;
  public abstract readonly validForeignKeysReferencingInvalidColumns: ReadonlyArray<ForeignKey>;

  public constructor(
    public readonly parent: SchemaFix,
    public readonly table: Table,
  ) {}

  public get dependencies(): ReadonlyArray<TableFix> {
    return this.parent.tableFixes.filter(
      (fix) =>
        fix !== this &&
        (this.missingForeignKeys.some(
          (foreignKey) =>
            foreignKey.referencedTable === fix.table &&
            (fix instanceof MissingTableFix ||
              (fix instanceof InvalidTableFix &&
                R.intersection(foreignKey.referencedTable.columns, [
                  ...fix.missingColumns,
                  ...fix.invalidColumns.map(({ column }) => column),
                ]).length > 0)),
        ) ||
          this.validForeignKeysReferencingInvalidColumns.some(
            (foreignKey) => foreignKey.referencedTable === fix.table,
          )),
    );
  }

  public async prepare(): Promise<void> {}
  public async execute(): Promise<void> {}
  public async finalize(): Promise<void> {}
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

  public readonly validForeignKeysReferencingInvalidColumns: ReadonlyArray<ForeignKey> =
    [];

  public override async execute(): Promise<void> {
    await this.table.create({ withForeignKeys: this.missingForeignKeys });
  }
}

abstract class AbstractExistingTableFix extends AbstractTableFix {
  public constructor(
    parent: SchemaFix,
    table: Table,
    public readonly diagnosis?: TableDiagnosis,
  ) {
    super(parent, table);
  }

  /**
   * These foreign-keys will be DROP in order to fix the columns they're referencing, then re-ADD.
   */
  public get validForeignKeysReferencingInvalidColumns(): ReadonlyArray<ForeignKey> {
    return R.pipe(
      this.table.foreignKeys,
      R.difference(this.diagnosis?.missingForeignKeys ?? []),
      R.filter((foreignKey) =>
        this.parent.invalidTableFixes.some(
          (fix) =>
            foreignKey.referencedTable === fix.table &&
            R.intersection(
              foreignKey.referencedIndex.columns,
              fix.invalidColumns.map(({ column }) => column),
            ).length > 0,
        ),
      ),
    );
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

export class InvalidTableFix extends AbstractExistingTableFix {
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
    super(parent, diagnosis.table, diagnosis);

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

  protected get missingForeignKeysReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return this.missingForeignKeys.filter(
      (foreignKey) =>
        foreignKey.referencedTable === this.table &&
        R.intersection(
          foreignKey.referencedIndex.columns,
          this.invalidColumns.map(({ column }) => column),
        ).length > 0,
    );
  }

  protected get missingForeignKeysNotReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return R.difference(
      this.missingForeignKeys,
      this.missingForeignKeysReferencingThisTableInvalidColumns,
    );
  }

  protected get validForeignKeysReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return super.validForeignKeysReferencingInvalidColumns.filter(
      (foreignKey) => foreignKey.referencedTable === this.table,
    );
  }

  protected get validForeignKeysNotReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return R.difference(
      super.validForeignKeysReferencingInvalidColumns,
      this.validForeignKeysReferencingThisTableInvalidColumns,
    );
  }

  public get foreignKeysReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return [
      ...this.missingForeignKeysReferencingThisTableInvalidColumns,
      ...this.validForeignKeysReferencingThisTableInvalidColumns,
    ];
  }

  public get foreignKeysNotReferencingThisTableInvalidColumns(): ReadonlyArray<ForeignKey> {
    return [
      ...this.missingForeignKeysNotReferencingThisTableInvalidColumns,
      ...this.validForeignKeysNotReferencingThisTableInvalidColumns,
    ];
  }

  public override async prepare(): Promise<void> {
    const connector = this.table.schema.connector;

    if (FixTableStatement.supports(this, FixTableStatementStep.PREPARATION)) {
      await connector.executeStatement(
        new FixTableStatement(this, FixTableStatementStep.PREPARATION),
      );
    }
  }

  public override async execute(): Promise<void> {
    const connector = this.table.schema.connector;

    if (FixTableStatement.supports(this, FixTableStatementStep.EXECUTION)) {
      await connector.executeStatement(
        new FixTableStatement(this, FixTableStatementStep.EXECUTION),
      );
    }
  }

  public override async finalize(): Promise<void> {
    if (this.foreignKeysReferencingThisTableInvalidColumns.length) {
      await this.table.addForeignKeys(
        this.foreignKeysReferencingThisTableInvalidColumns,
      );
    }
  }
}

export class ValidOrUntouchedInvalidTableFix extends AbstractExistingTableFix {
  public readonly missingForeignKeys: ReadonlyArray<ForeignKey> = [];

  public override async prepare(): Promise<void> {
    if (this.validForeignKeysReferencingInvalidColumns.length) {
      await this.table.dropForeignKeys(
        this.validForeignKeysReferencingInvalidColumns,
      );
    }
  }

  public override async execute(): Promise<void> {
    if (this.validForeignKeysReferencingInvalidColumns.length) {
      await this.table.addForeignKeys(
        this.validForeignKeysReferencingInvalidColumns,
      );
    }
  }
}

export type TableFix =
  | MissingTableFix
  | InvalidTableFix
  | ValidOrUntouchedInvalidTableFix;
