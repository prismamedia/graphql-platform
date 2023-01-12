import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';
import type {
  Column,
  ForeignKeyIndex,
  LeafColumn,
  PlainIndex,
  ReferenceColumn,
  Table,
  UniqueIndex,
} from './table.js';

export interface SchemaNamingStrategyConfig {
  table?: (node: core.Node) => string;
  leaf?: (tableName: Table['name'], leaf: core.Leaf) => string;
  reference?: (
    tableName: Table['name'],
    edge: core.Edge,
    referencedColumn: Column,
  ) => string;
  foreignKeyIndex?: (
    tableName: Table['name'],
    edge: core.Edge,
    references: ReadonlyArray<ReferenceColumn>,
  ) => string;
  uniqueIndex?: (
    tableName: Table['name'],
    uniqueConstraint: core.UniqueConstraint,
    columns: ReadonlyArray<Column>,
  ) => string;
  plainIndex?: (
    tableName: Table['name'],
    columns: ReadonlyArray<Column>,
  ) => string;
}

export class SchemaNamingStrategy {
  public constructor(
    public readonly config?: SchemaNamingStrategyConfig,
    public readonly configPath?: utils.Path,
  ) {}

  public getTableName(node: core.Node): Table['name'] {
    const config = this.config?.table;
    const configPath = utils.addPath(this.configPath, 'table');

    const name = config?.(node) ?? inflection.tableize(node.name);

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }

  public getLeafColumnName(
    tableName: Table['name'],
    leaf: core.Leaf,
  ): LeafColumn['name'] {
    const config = this.config?.leaf;
    const configPath = utils.addPath(this.configPath, 'leaf');

    const name =
      config?.(tableName, leaf) ??
      inflection.underscore(leaf.name).replaceAll('-', '_');

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }

  public getReferenceColumnName(
    tableName: Table['name'],
    edge: core.Edge,
    referencedColumn: Column,
  ): ReferenceColumn['name'] {
    const config = this.config?.reference;
    const configPath = utils.addPath(this.configPath, 'reference');

    const name =
      config?.(tableName, edge, referencedColumn) ??
      `${inflection.underscore(edge.name).replaceAll('-', '_')}_${
        referencedColumn.name
      }`;

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }

  public getForeignKeyIndexName(
    tableName: Table['name'],
    edge: core.Edge,
    references: ReadonlyArray<ReferenceColumn>,
  ): ForeignKeyIndex['name'] {
    const config = this.config?.foreignKeyIndex;
    const configPath = utils.addPath(this.configPath, 'foreignKeyIndex');

    const name =
      config?.(tableName, edge, references) ??
      ['fk', tableName, ...references.map(({ name }) => name)].join('_');

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }

  public getUniqueIndexName(
    tableName: Table['name'],
    uniqueConstraint: core.UniqueConstraint,
    columns: ReadonlyArray<Column>,
  ): UniqueIndex['name'] {
    const config = this.config?.uniqueIndex;
    const configPath = utils.addPath(this.configPath, 'uniqueIndex');

    const name =
      config?.(tableName, uniqueConstraint, columns) ??
      [
        'unq',
        inflection.underscore(uniqueConstraint.name).replaceAll('-', '_'),
      ].join('_');

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }

  public getPlainIndexName(
    tableName: Table['name'],
    columns: ReadonlyArray<Column>,
  ): PlainIndex['name'] {
    const config = this.config?.plainIndex;
    const configPath = utils.addPath(this.configPath, 'plainIndex');

    const name =
      config?.(tableName, columns) ??
      ['idx', ...columns.map(({ name }) => name)].join('_');

    if (typeof name !== 'string') {
      throw new utils.UnexpectedValueError('a string', name, {
        path: configPath,
      });
    }

    // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
    if (name.length > 64) {
      throw new utils.UnexpectedValueError(
        'an identifier shorter than 64 characters',
        name,
        { path: configPath },
      );
    }

    return name;
  }
}
