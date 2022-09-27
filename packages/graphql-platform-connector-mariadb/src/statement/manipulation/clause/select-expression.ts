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

function parseReverseEdgeMultipleSelection(
  tableReference: TableReference,
  selection: core.ReverseEdgeMultipleSelection,
): string {
  if (selection instanceof core.ReverseEdgeMultipleCountSelection) {
    return `(${tableReference.subquery(
      `COUNT(*)`,
      selection.reverseEdge,
      selection.headFilter,
    )})`;
  } else if (selection instanceof core.ReverseEdgeMultipleHeadSelection) {
    return `(${tableReference.subquery(
      (tableReference) =>
        `JSON_ARRAYAGG(${[
          selectNode(tableReference, selection.headSelection),
          // Even if the subquery is already sorted below, we must sort again here
          selection.headOrdering &&
            `ORDER BY ${orderNode(tableReference, selection.headOrdering)}`,
        ]
          .filter(Boolean)
          .join(' ')})`,
      selection.reverseEdge,
      selection.headFilter,
      selection.headOrdering,
      selection.limit,
      selection.offset,
    )})`;
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseReverseEdgeUniqueSelection(
  tableReference: TableReference,
  selection: core.ReverseEdgeUniqueSelection,
): string {
  const joinTable = tableReference.join(selection.reverseEdge);
  const foreignKey = joinTable.table.getForeignKeyByEdge(
    selection.reverseEdge.originalEdge,
  );

  if (selection instanceof core.ReverseEdgeUniqueHeadSelection) {
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
  } else if (core.isReverseEdgeMultipleSelection(selection)) {
    return parseReverseEdgeMultipleSelection(tableReference, selection);
  } else if (core.isReverseEdgeUniqueSelection(selection)) {
    return parseReverseEdgeUniqueSelection(tableReference, selection);
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
