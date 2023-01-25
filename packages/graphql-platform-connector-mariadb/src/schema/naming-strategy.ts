import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type {
  ForeignKey,
  FullTextIndex,
  LeafColumn,
  PlainIndex,
  ReferenceColumn,
  Table,
  UniqueIndex,
} from './table.js';

/**
 * @see https://mariadb.com/kb/en/identifier-names/
 */
export type IdentifierName = string;

export function assertIdentifierName(
  maybeIdentifierName: unknown,
  path?: utils.Path,
): asserts maybeIdentifierName is IdentifierName {
  if (typeof maybeIdentifierName !== 'string') {
    throw new utils.UnexpectedValueError('a string', maybeIdentifierName, {
      path,
    });
  }

  if (!maybeIdentifierName) {
    throw new utils.UnexpectedValueError(
      'a non-empty string',
      maybeIdentifierName,
      { path },
    );
  }

  // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
  if (maybeIdentifierName.length > 64) {
    throw new utils.UnexpectedValueError(
      'a string shorter than 64 characters',
      maybeIdentifierName,
      { path },
    );
  }
}

export function ensureIdentifierName(
  maybeIdentifierName: unknown,
  path?: utils.Path,
): IdentifierName {
  assertIdentifierName(maybeIdentifierName, path);

  return maybeIdentifierName;
}

export interface SchemaNamingStrategyConfig {
  table?: (table: Table) => utils.Nillable<Table['name']>;
  leaf?: (column: LeafColumn) => utils.Nillable<LeafColumn['name']>;
  reference?: (
    column: ReferenceColumn,
  ) => utils.Nillable<ReferenceColumn['name']>;
  foreignKey?: (index: ForeignKey) => utils.Nillable<ForeignKey['name']>;
  uniqueIndex?: (index: UniqueIndex) => utils.Nillable<UniqueIndex['name']>;
  plainIndex?: (index: PlainIndex) => utils.Nillable<PlainIndex['name']>;
  fullTextIndex?: (
    index: FullTextIndex,
  ) => utils.Nillable<FullTextIndex['name']>;
}

export class SchemaNamingStrategy {
  public constructor(
    public readonly config?: SchemaNamingStrategyConfig,
    public readonly configPath?: utils.Path,
  ) {}

  public getTableName(table: Table): Table['name'] {
    const config = this.config?.table;
    const configPath = utils.addPath(this.configPath, 'table');

    return ensureIdentifierName(
      config?.(table) ?? inflection.underscore(table.node.plural),
      configPath,
    );
  }

  public getLeafColumnName(column: LeafColumn): LeafColumn['name'] {
    const config = this.config?.leaf;
    const configPath = utils.addPath(this.configPath, 'leaf');

    return ensureIdentifierName(
      config?.(column) ?? inflection.underscore(column.leaf.name),
      configPath,
    );
  }

  public getReferenceColumnName(
    column: ReferenceColumn,
  ): ReferenceColumn['name'] {
    const config = this.config?.reference;
    const configPath = utils.addPath(this.configPath, 'reference');

    return ensureIdentifierName(
      config?.(column) ??
        `${inflection.underscore(column.edge.name)}_${
          column.referencedColumn.name
        }`,
      configPath,
    );
  }

  public getForeignKeyName(index: ForeignKey): ForeignKey['name'] {
    const config = this.config?.foreignKey;
    const configPath = utils.addPath(this.configPath, 'foreignKey');

    return ensureIdentifierName(
      config?.(index) ??
        ['fk', index.table.name, ...index.columns.map(({ name }) => name)].join(
          '_',
        ),
      configPath,
    );
  }

  public getUniqueIndexName(index: UniqueIndex): UniqueIndex['name'] {
    const config = this.config?.uniqueIndex;
    const configPath = utils.addPath(this.configPath, 'uniqueIndex');

    return ensureIdentifierName(
      config?.(index) ??
        ['unq', ...index.columns.map(({ name }) => name)].join('_'),
      configPath,
    );
  }

  public getPlainIndexName(index: PlainIndex): PlainIndex['name'] {
    const config = this.config?.plainIndex;
    const configPath = utils.addPath(this.configPath, 'plainIndex');

    return ensureIdentifierName(
      config?.(index) ??
        ['idx', ...index.columns.map(({ name }) => name)].join('_'),
      configPath,
    );
  }

  public getFullTextIndexName(index: FullTextIndex): FullTextIndex['name'] {
    const config = this.config?.fullTextIndex;
    const configPath = utils.addPath(this.configPath, 'fullTextIndex');

    return ensureIdentifierName(
      config?.(index) ??
        ['ft', ...index.columns.map(({ name }) => name)].join('_'),
      configPath,
    );
  }
}
