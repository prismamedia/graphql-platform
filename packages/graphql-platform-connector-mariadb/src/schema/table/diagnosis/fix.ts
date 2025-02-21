import * as utils from '@prismamedia/graphql-platform-utils';
import * as R from 'remeda';
import type { PoolConnection } from '../../../index.js';
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
  public readonly connector;

  public constructor(
    public readonly parent: SchemaFix,
    public readonly table: Table,
  ) {
    this.connector = table.schema.connector;
  }

  public abstract get dependencies(): ReadonlyArray<TableFix>;

  public async prepare(_connection?: PoolConnection): Promise<void> {}

  public async execute(_connection?: PoolConnection): Promise<void> {}

  public async finalize(_connection?: PoolConnection): Promise<void> {}
}

export class MissingTableFix extends AbstractTableFix {
  public readonly dependencies: ReadonlyArray<TableFix> = [];

  public get creatableForeignKeys(): ReadonlyArray<ForeignKey> {
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
          (R.intersection(a.referencedIndex.columns, [
            ...b.missingColumns,
            ...b.invalidColumns
              .filter(({ dataTypeError }) => !!dataTypeError)
              .map(({ column }) => column),
          ]).length > 0 ||
            b.missingIndexes.includes(a.referencedIndex) ||
            b.invalidIndexes.some(({ index }) => index === a.referencedIndex)),
      ),
      R.differenceWith(
        this.parent.invalidTableFixes,
        (a, b) =>
          a.referencedTable === b.table &&
          (R.intersection(a.referencedIndex.columns, [
            ...b.untouchedMissingColumns,
            ...b.untouchedInvalidColumns
              .filter(({ dataTypeError }) => !!dataTypeError)
              .map(({ column }) => column),
          ]).length > 0 ||
            b.untouchedMissingIndexes.includes(a.referencedIndex) ||
            b.untouchedInvalidIndexes.some(
              ({ index }) => index === a.referencedIndex,
            )),
      ),
    );
  }

  public override async prepare(connection?: PoolConnection): Promise<void> {
    await this.table.create({ withForeignKeys: false }, connection);
  }

  public override async finalize(connection?: PoolConnection): Promise<void> {
    await this.table.addForeignKeys(this.creatableForeignKeys, connection);
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
   * These foreign-keys will be DROP in order to fix the columns and indexes they're referencing, then re-ADD.
   */
  public get existingForeignKeysReferencingInvalidColumnsOrIndexes(): ReadonlyArray<ForeignKey> {
    return R.pipe(
      this.table.foreignKeys,
      R.difference(this.diagnosis?.missingForeignKeys ?? []),
      R.filter((foreignKey) =>
        this.parent.invalidTableFixes.some(
          (fix) =>
            foreignKey.referencedTable === fix.table &&
            (R.intersection(
              foreignKey.referencedIndex.columns,
              fix.invalidColumns.map(({ column }) => column),
            ).length ||
              fix.invalidIndexes.some(
                ({ index }) => index === foreignKey.referencedIndex,
              )),
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
  public readonly untouchedMissingIndexes: ReadonlyArray<Index>;
  public readonly invalidIndexes: ReadonlyArray<IndexDiagnosis>;
  public readonly untouchedInvalidIndexes: ReadonlyArray<IndexDiagnosis>;

  public readonly nullable: boolean;
  public readonly extraColumns: ReadonlyArray<Column['name']>;
  public readonly missingColumns: ReadonlyArray<Column>;
  public readonly untouchedMissingColumns: ReadonlyArray<Column>;
  public readonly invalidColumns: ReadonlyArray<ColumnDiagnosis>;
  public readonly untouchedInvalidColumns: ReadonlyArray<ColumnDiagnosis>;

  public constructor(
    parent: SchemaFix,
    public override readonly diagnosis: TableDiagnosis,
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

      this.untouchedMissingIndexes = R.difference(
        diagnosis.missingIndexes,
        this.missingIndexes,
      );

      this.invalidIndexes = R.pipe(
        diagnosis.invalidIndexes,
        R.intersectionWith(this.#indexes, (a, b) => a.index.name === b),
      );

      this.untouchedInvalidIndexes = R.difference(
        diagnosis.invalidIndexes,
        this.invalidIndexes,
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

      this.untouchedInvalidColumns = R.difference(
        diagnosis.invalidColumns,
        this.invalidColumns,
      );
    }
  }

  public override get existingForeignKeysReferencingInvalidColumnsOrIndexes(): ReadonlyArray<ForeignKey> {
    return R.differenceWith(
      super.existingForeignKeysReferencingInvalidColumnsOrIndexes,
      this.invalidForeignKeys,
      (a, b) => a === b.foreignKey,
    );
  }

  public get creatableMissingForeignKeys(): ReadonlyArray<ForeignKey> {
    return R.pipe(
      this.diagnosis.missingForeignKeys,
      R.intersectionWith(this.#foreignKeys, (a, b) => a.name === b),
      R.filter(
        (foreignKey) =>
          !R.intersection(foreignKey.columns, [
            ...this.untouchedMissingColumns,
            ...this.untouchedInvalidColumns
              .filter(({ dataTypeError }) => !!dataTypeError)
              .map(({ column }) => column),
          ]).length,
      ),
      R.differenceWith(
        this.parent.untouchedMissingTables,
        (a, b) => a.referencedTable === b,
      ),
      R.differenceWith(
        this.parent.untouchedInvalidTables,
        (a, b) =>
          a.referencedTable === b.table &&
          (R.intersection(a.referencedIndex.columns, [
            ...b.missingColumns,
            ...b.invalidColumns
              .filter(({ dataTypeError }) => !!dataTypeError)
              .map(({ column }) => column),
          ]).length > 0 ||
            b.missingIndexes.includes(a.referencedIndex) ||
            b.invalidIndexes.some(({ index }) => index === a.referencedIndex)),
      ),
      R.differenceWith(
        this.parent.invalidTableFixes,
        (a, b) =>
          a.referencedTable === b.table &&
          (R.intersection(a.referencedIndex.columns, [
            ...b.untouchedMissingColumns,
            ...b.untouchedInvalidColumns
              .filter(({ dataTypeError }) => !!dataTypeError)
              .map(({ column }) => column),
          ]).length > 0 ||
            b.untouchedMissingIndexes.includes(a.referencedIndex) ||
            b.untouchedInvalidIndexes.some(
              ({ index }) => index === a.referencedIndex,
            )),
      ),
    );
  }

  protected get creatableForeignKeys(): ReadonlyArray<ForeignKey> {
    return [
      ...this.existingForeignKeysReferencingInvalidColumnsOrIndexes,
      ...this.creatableMissingForeignKeys,
      ...this.invalidForeignKeys.map(({ foreignKey }) => foreignKey),
    ];
  }

  public get creatableForeignKeysNotReferencingThisFixableResources(): ReadonlyArray<ForeignKey> {
    return this.creatableForeignKeys.filter(
      (foreignKey) =>
        foreignKey.referencedTable !== this.table ||
        (!R.intersection(foreignKey.referencedIndex.columns, [
          ...this.missingColumns,
          ...this.invalidColumns.map(({ column }) => column),
        ]).length &&
          !this.invalidIndexes.some(
            ({ index }) => index === foreignKey.referencedIndex,
          )),
    );
  }

  public get creatableForeignKeysReferencingThisFixableResources(): ReadonlyArray<ForeignKey> {
    return R.difference(
      this.creatableForeignKeys,
      this.creatableForeignKeysNotReferencingThisFixableResources,
    );
  }

  public get dependencies(): ReadonlyArray<TableFix> {
    return this.parent.tableFixes.filter(
      (fix) =>
        fix !== this &&
        (this.creatableMissingForeignKeys.some(
          (foreignKey) =>
            foreignKey.referencedTable === fix.table &&
            (fix instanceof MissingTableFix ||
              (fix instanceof InvalidTableFix &&
                (R.intersection(foreignKey.referencedTable.columns, [
                  ...fix.missingColumns,
                  ...fix.invalidColumns.map(({ column }) => column),
                ]).length ||
                  fix.invalidIndexes.some(
                    ({ index }) => index === foreignKey.referencedIndex,
                  )))),
        ) ||
          this.existingForeignKeysReferencingInvalidColumnsOrIndexes.some(
            (foreignKey) => foreignKey.referencedTable === fix.table,
          )),
    );
  }

  public override async prepare(connection?: PoolConnection): Promise<void> {
    if (FixTableStatement.supports(this, FixTableStatementStep.PREPARATION)) {
      await this.connector.executeStatement(
        new FixTableStatement(this, FixTableStatementStep.PREPARATION),
        connection,
      );
    }
  }

  public override async execute(connection?: PoolConnection): Promise<void> {
    if (FixTableStatement.supports(this, FixTableStatementStep.EXECUTION)) {
      await this.connector.executeStatement(
        new FixTableStatement(this, FixTableStatementStep.EXECUTION),
        connection,
      );
    }
  }

  public override async finalize(connection?: PoolConnection): Promise<void> {
    await this.table.addForeignKeys(
      this.creatableForeignKeysReferencingThisFixableResources,
      connection,
    );
  }
}

export class ValidOrUntouchedInvalidTableFix extends AbstractExistingTableFix {
  public override get dependencies(): ReadonlyArray<TableFix> {
    return this.parent.tableFixes.filter(
      (fix) =>
        fix !== this &&
        this.existingForeignKeysReferencingInvalidColumnsOrIndexes.some(
          (foreignKey) => foreignKey.referencedTable === fix.table,
        ),
    );
  }

  public override async prepare(connection?: PoolConnection): Promise<void> {
    await this.table.dropForeignKeys(
      this.existingForeignKeysReferencingInvalidColumnsOrIndexes,
      connection,
    );
  }

  public override async execute(connection?: PoolConnection): Promise<void> {
    await this.table.addForeignKeys(
      this.existingForeignKeysReferencingInvalidColumnsOrIndexes,
      connection,
    );
  }
}

export type TableFix =
  | MissingTableFix
  | InvalidTableFix
  | ValidOrUntouchedInvalidTableFix;
