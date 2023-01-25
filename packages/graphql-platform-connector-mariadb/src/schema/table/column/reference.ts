import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { MariaDBConnector } from '../../../index.js';
import type { Column, Schema, Table } from '../../../schema.js';
import { ensureIdentifierName } from '../../naming-strategy.js';
import { AbstractColumn } from '../abstract-column.js';
import type { DataType } from '../data-type.js';

export * from './reference/diagnosis.js';

export class ReferenceColumn extends AbstractColumn {
  public readonly name: string;
  public readonly comment?: string;
  public readonly dataType: DataType;

  public constructor(
    table: Table,
    public readonly edge: core.Edge<any, MariaDBConnector>,
    public readonly referencedColumn: Column,
    nameConfig: utils.Nillable<string>,
    nameConfigPath: utils.Path,
  ) {
    super(table, edge);

    // name
    {
      this.name = nameConfig
        ? ensureIdentifierName(nameConfig, nameConfigPath)
        : table.schema.namingStrategy.getReferenceColumnName(this);
    }

    // data-type
    {
      this.dataType = referencedColumn.dataType;
    }
  }

  public override isAutoIncrement(): boolean {
    return false;
  }

  @Memoize()
  public override isNullable(): boolean {
    return this.edge.isNullable() || this.referencedColumn.isNullable();
  }

  /**
   * category: {
   *   parent: {
   *     parent: null
   *     slug: "root"
   *   },
   *   slug: "news"
   * }
   *
   * ->
   *
   * category_parent_parent: null
   * category_parent_slug: "root"
   * category_slug: "news"
   */
  public pickLeafValueFromReferenceValue(
    referenceValue: core.ReferenceValue,
  ): core.LeafValue {
    if (referenceValue === null) {
      return null;
    }

    return this.referencedColumn instanceof ReferenceColumn
      ? this.referencedColumn.pickLeafValueFromReferenceValue(
          referenceValue[
            this.referencedColumn.edge.name
          ] as core.ReferenceValue,
        )
      : (referenceValue[this.referencedColumn.leaf.name] as core.LeafValue);
  }
}

export interface ReferenceColumnTreeConfig {
  [componentName: string]: utils.Optional<string | ReferenceColumnTreeConfig>;
}

/**
 * The columns are grouped by their referenced component
 */
export class ReferenceColumnTree {
  readonly #currentEdge: core.Edge<any, MariaDBConnector>;
  readonly #columnsByLeaf: ReadonlyMap<core.Leaf, ReferenceColumn>;
  readonly #columnTreesByEdge: ReadonlyMap<core.Edge, ReferenceColumnTree>;

  public constructor(
    schema: Schema,
    root: core.Edge<any, MariaDBConnector>,
    path: ReadonlyArray<core.Edge<any, MariaDBConnector>> = [],
  ) {
    const tail = schema.getTableByNode(root.tail);
    const head = schema.getTableByNode(root.head);

    let columnsConfig = root.config.columns;
    let columnsConfigPath = utils.addPath(root.configPath, 'columns');

    // config
    {
      utils.assertNillablePlainObject(columnsConfig, columnsConfigPath);

      [columnsConfig, columnsConfigPath] = path.reduce<
        [utils.Optional<ReferenceColumnTreeConfig>, utils.Path]
      >(
        ([config, path], edge) => {
          const edgeConfig = config?.[edge.name];
          const edgeConfigPath = utils.addPath(path, edge.name);

          utils.assertNillablePlainObject(edgeConfig, edgeConfigPath);

          return [edgeConfig ?? undefined, edgeConfigPath];
        },
        [columnsConfig, columnsConfigPath],
      );
    }

    // current-edge
    {
      this.#currentEdge = path.at(-1) ?? root;
    }

    // columns-by-leaf
    {
      this.#columnsByLeaf = new Map(
        this.#currentEdge.referencedUniqueConstraint.leaves.map((leaf) => [
          leaf,
          new ReferenceColumn(
            tail,
            root,
            path.length
              ? head
                  .getColumnTreeByEdge(path[0])
                  .at(path.slice(1))
                  .getColumnByLeaf(leaf)
              : head.getColumnByLeaf(leaf),
            columnsConfig?.[leaf.name] as any,
            utils.addPath(columnsConfigPath, leaf.name),
          ),
        ]),
      );
    }

    // column-trees-by-edge
    {
      this.#columnTreesByEdge = new Map(
        this.#currentEdge.referencedUniqueConstraint.edges.map((edge) => [
          edge,
          new ReferenceColumnTree(schema, root, [...path, edge]),
        ]),
      );
    }
  }

  public at(
    path: ReadonlyArray<core.Edge<any, MariaDBConnector>>,
  ): ReferenceColumnTree {
    return path.reduce<ReferenceColumnTree>(
      (tree, edge) => tree.getColumnTreeByEdge(edge),
      this,
    );
  }

  public getColumnByLeaf(leaf: core.Leaf): ReferenceColumn {
    const column = this.#columnsByLeaf.get(leaf);
    assert(
      column,
      `The leaf "${leaf}" is not part of the unique-constraint "${
        this.#currentEdge.referencedUniqueConstraint
      }"`,
    );

    return column;
  }

  public getColumnTreeByEdge(edge: core.Edge): ReferenceColumnTree {
    const columnTree = this.#columnTreesByEdge.get(edge);
    assert(
      columnTree,
      `The edge "${edge}" is not part of the unique-constraint "${
        this.#currentEdge.referencedUniqueConstraint
      }"`,
    );

    return columnTree;
  }

  @Memoize()
  public get columns(): ReadonlyArray<ReferenceColumn> {
    return Object.freeze(
      this.#currentEdge.referencedUniqueConstraint.components.flatMap(
        (component) =>
          component instanceof core.Leaf
            ? this.getColumnByLeaf(component)
            : this.getColumnTreeByEdge(component).columns,
      ),
    );
  }

  public pickReferenceValueFromRow(
    row: utils.PlainObject,
  ): core.ReferenceValue {
    return this.columns.some((column) => row[column.name] !== null)
      ? this.#currentEdge.referencedUniqueConstraint.components.reduce(
          (uniqueConstraintValue, component) =>
            Object.assign(uniqueConstraintValue, {
              [component.name]:
                component instanceof core.Leaf
                  ? this.getColumnByLeaf(component).pickLeafValueFromRow(row)
                  : this.getColumnTreeByEdge(
                      component,
                    ).pickReferenceValueFromRow(row),
            }),
          Object.create(null),
        )
      : null;
  }
}
