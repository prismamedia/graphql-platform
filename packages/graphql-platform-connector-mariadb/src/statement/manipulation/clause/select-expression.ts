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
  if (selection instanceof core.EdgeHeadSelection) {
    return tableReference.subquery(selection.edge, (headReference) =>
      selectNode(headReference, selection.headSelection),
    );
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseUniqueReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.UniqueReverseEdgeSelection,
): string {
  if (selection instanceof core.UniqueReverseEdgeHeadSelection) {
    return tableReference.subquery(selection.reverseEdge, (headReference) =>
      selectNode(headReference, selection.headSelection),
    );
  } else {
    throw new utils.UnreachableValueError(selection);
  }
}

function parseMultipleReverseEdgeSelection(
  tableReference: TableReference,
  selection: core.MultipleReverseEdgeSelection,
): string {
  if (selection instanceof core.MultipleReverseEdgeCountSelection) {
    return tableReference.subquery(
      selection.reverseEdge,
      `COUNT(*)`,
      selection.headFilter,
    );
  } else if (selection instanceof core.MultipleReverseEdgeHeadSelection) {
    return tableReference.subquery(
      selection.reverseEdge,
      (headReference) =>
        `JSON_ARRAYAGG(${[
          selectNode(headReference, selection.headSelection),
          selection.headOrdering &&
            `ORDER BY ${orderNode(headReference, selection.headOrdering)}`,
          `LIMIT ${selection.limit}`,
          selection.offset && `OFFSET ${selection.offset}`,
        ]
          .filter(Boolean)
          .join(' ')})`,
      selection.headFilter,
    );
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
  } else if (core.isUniqueReverseEdgeSelection(selection)) {
    return parseUniqueReverseEdgeSelection(tableReference, selection);
  } else if (core.isMultipleReverseEdgeSelection(selection)) {
    return parseMultipleReverseEdgeSelection(tableReference, selection);
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
