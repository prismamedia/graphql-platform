import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { orderNode } from './ordering-expression.js';
import type { TableReference } from './table-reference.js';

export type SelectExpression = string;

function parseLeafSelection(
  tableReference: TableReference,
  selection: core.LeafSelection,
): string {
  return tableReference.getEscapedColumnIdentifierByLeaf(selection.leaf);
}

function parseEdgeSelection(
  tableReference: TableReference,
  selection: core.EdgeSelection,
): string {
  const foreignKey = tableReference.table.getForeignKeyByEdge(selection.edge);
  const joinTable = tableReference.join(selection.edge);

  if (selection instanceof core.EdgeHeadSelection) {
    return `IF(${foreignKey.columns
      .map(
        ({ referencedColumn }) =>
          `${joinTable.getEscapedColumnIdentifier(
            referencedColumn,
          )} IS NOT NULL`,
      )
      .join(' OR ')}, ${selectNode(joinTable, selection.headSelection)}, NULL)`;
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseMultipleReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.MultipleReverseEdgeSelection,
): string {
  if (selection instanceof core.MultipleReverseEdgeCountSelection) {
    return `(${tableReference.subquery(
      `COUNT(*)`,
      selection.reverseEdge,
      selection.headFilter,
    )})`;
  } else if (selection instanceof core.MultipleReverseEdgeHeadSelection) {
    return `(${tableReference.subquery(
      (tableReference) =>
        `JSON_ARRAYAGG(${[
          selectNode(tableReference, selection.headSelection),
          selection.headOrdering &&
            `ORDER BY ${orderNode(tableReference, selection.headOrdering)}`,
          selection.limit && `LIMIT ${selection.limit}`,
          selection.offset && `OFFSET ${selection.offset}`,
        ]
          .filter(Boolean)
          .join(' ')})`,
      selection.reverseEdge,
      selection.headFilter,
    )})`;
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseUniqueReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.UniqueReverseEdgeSelection,
): string {
  const joinTable = tableReference.join(selection.reverseEdge);
  const foreignKey = joinTable.table.getForeignKeyByEdge(
    selection.reverseEdge.originalEdge,
  );

  if (selection instanceof core.UniqueReverseEdgeHeadSelection) {
    return `IF(${foreignKey.columns
      .map(
        (column) =>
          `${joinTable.getEscapedColumnIdentifier(column)} IS NOT NULL`,
      )
      .join(' OR ')}, ${selectNode(joinTable, selection.headSelection)}, NULL)`;
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseSelectionExpression(
  tableReference: TableReference,
  selection: core.SelectionExpression,
): string {
  if (selection instanceof core.LeafSelection) {
    return parseLeafSelection(tableReference, selection);
  } else if (core.isEdgeSelection(selection)) {
    return parseEdgeSelection(tableReference, selection);
  } else if (core.isMultipleReverseEdgeSelection(selection)) {
    return parseMultipleReverseEdgeSelection(tableReference, selection);
  } else if (core.isUniqueReverseEdgeSelection(selection)) {
    return parseUniqueReverseEdgeSelection(tableReference, selection);
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
): SelectExpression {
  assert.equal(tableReference.table.node, nodeSelection.node);

  return `JSON_OBJECT(${nodeSelection.expressions
    .flatMap((expression) => [
      `"${expression.key}"`,
      parseSelectionExpression(tableReference, expression),
    ])
    .join(', ')})`;
}
