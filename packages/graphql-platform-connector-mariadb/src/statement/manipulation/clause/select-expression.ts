import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { ReferenceColumnTree } from '../../../schema.js';
import { orderNode } from './ordering-expression.js';
import type { TableReference } from './table-reference.js';
import { AND, OR, filterNode } from './where-condition.js';

export type SelectExpression = string;

function parseLeafSelection(
  tableReference: TableReference,
  selection: core.LeafSelection,
  referenceColumnTree?: ReferenceColumnTree,
): string {
  const column =
    referenceColumnTree?.getColumnByLeaf(selection.leaf) ??
    tableReference.table.getColumnByLeaf(selection.leaf);

  return tableReference.escapeColumnIdentifier(column);
}

function parseEdgeSelection(
  tableReference: TableReference,
  selection: core.EdgeSelection,
  referenceColumnTree?: ReferenceColumnTree,
): string {
  const edge = selection.edge;

  if (selection instanceof core.EdgeHeadSelection) {
    if (referenceColumnTree) {
      const subTree = referenceColumnTree.getColumnTreeByEdge(edge);

      const parsedHeadSelection = selectNode(
        tableReference,
        selection.headSelection,
        subTree,
      );

      return edge.isNullable()
        ? `IF(
          ${OR(
            subTree.columns.map(
              (column) =>
                `${tableReference.escapeColumnIdentifier(column)} IS NOT NULL`,
            ),
          )},
          ${parsedHeadSelection},
          NULL
        )`
        : parsedHeadSelection;
    }

    const headAuthorization = tableReference.context?.getAuthorization(
      edge.head,
    );

    // If we can avoid a join, we do so.
    if (
      (!headAuthorization ||
        headAuthorization.isExecutableWithin(
          edge.referencedUniqueConstraint.selection,
        )) &&
      edge.referencedUniqueConstraint.selection.isSupersetOf(
        selection.headSelection,
      )
    ) {
      const parsedHeadAuthorization = headAuthorization
        ? filterNode(
            tableReference,
            headAuthorization,
            tableReference.table.getColumnTreeByEdge(edge),
          )
        : undefined;

      const parsedHeadSelection = selectNode(
        tableReference,
        selection.headSelection,
        tableReference.table.getColumnTreeByEdge(edge),
      );

      return edge.isNullable() || parsedHeadAuthorization
        ? `IF(${AND([
            OR(
              tableReference.table
                .getForeignKeyByEdge(edge)
                .columns.map(
                  (column) =>
                    `${tableReference.escapeColumnIdentifier(
                      column,
                    )} IS NOT NULL`,
                ),
            ),
            parsedHeadAuthorization,
          ])}, ${parsedHeadSelection}, NULL)`
        : parsedHeadSelection;
    }

    const joinTable = tableReference.join(edge);

    const parsedHeadSelection = selectNode(joinTable, selection.headSelection);

    return edge.isNullable() || headAuthorization
      ? `IF(${OR(
          joinTable.table
            .getColumnsByComponents(
              ...edge.referencedUniqueConstraint.componentSet,
            )
            .map(
              (column) =>
                `${joinTable.escapeColumnIdentifier(column)} IS NOT NULL`,
            ),
        )}, ${parsedHeadSelection}, NULL)`
      : parsedHeadSelection;
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseUniqueReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.UniqueReverseEdgeSelection,
): string {
  if (selection instanceof core.UniqueReverseEdgeHeadSelection) {
    return tableReference
      .subquery(selection.reverseEdge, {
        select: selection.headSelection,
      })
      .toString();
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseMultipleReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.MultipleReverseEdgeSelection,
): string {
  if (selection instanceof core.MultipleReverseEdgeCountSelection) {
    return tableReference
      .subquery(selection.reverseEdge, {
        select: `COUNT(*)`,
        where: selection.headFilter,
      })
      .toString();
  } else if (selection instanceof core.MultipleReverseEdgeHeadSelection) {
    return tableReference
      .subquery(selection.reverseEdge, {
        select: (headReference) =>
          `JSON_ARRAYAGG(${[
            selectNode(headReference, selection.headSelection),
            selection.headOrdering &&
              `ORDER BY ${orderNode(headReference, selection.headOrdering).join()}`,
            `LIMIT ${selection.limit}`,
            selection.offset && `OFFSET ${selection.offset}`,
          ]
            .filter(Boolean)
            .join(' ')})`,
        where: selection.headFilter,
      })
      .toString();
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseSelectionExpression(
  tableReference: TableReference,
  selection: core.SelectionExpression,
  referenceColumnTree?: ReferenceColumnTree,
): string {
  if (selection instanceof core.LeafSelection) {
    return parseLeafSelection(tableReference, selection, referenceColumnTree);
  } else if (core.isEdgeSelection(selection)) {
    return parseEdgeSelection(tableReference, selection, referenceColumnTree);
  } else if (core.isUniqueReverseEdgeSelection(selection)) {
    return parseUniqueReverseEdgeSelection(tableReference, selection);
  } else if (core.isMultipleReverseEdgeSelection(selection)) {
    return parseMultipleReverseEdgeSelection(tableReference, selection);
  } else if (selection instanceof core.VirtualSelection) {
    return selection.sourceSelection
      ? selectNode(
          tableReference,
          selection.sourceSelection,
          referenceColumnTree,
        )
      : 'NULL';
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

/**
 * @see https://mariadb.com/kb/en/select/#select-expressions
 */
export function selectNode(
  tableReference: TableReference,
  nodeSelection: core.NodeSelection,
  referenceColumnTree?: ReferenceColumnTree,
): SelectExpression {
  referenceColumnTree
    ? assert.strictEqual(
        referenceColumnTree.currentEdge.head,
        nodeSelection.node,
      )
    : assert.strictEqual(tableReference.table.node, nodeSelection.node);

  return `JSON_OBJECT(${nodeSelection.expressions
    .flatMap((expression) => [
      `"${expression.key}"`,
      parseSelectionExpression(tableReference, expression, referenceColumnTree),
    ])
    .join(', ')})`;
}
