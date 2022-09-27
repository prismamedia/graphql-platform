import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { escapeStringValue } from '../../../escaping.js';
import type { TableReference } from './table-reference.js';

export type WhereCondition = string;

function parseBooleanOperation(
  tableReference: TableReference,
  filter: core.BooleanOperation,
): WhereCondition {
  if (filter instanceof core.AndOperation) {
    return `(${filter.operands
      .map((operand) => parseBooleanFilter(tableReference, operand))
      .join(' AND ')})`;
  } else if (filter instanceof core.OrOperation) {
    return `(${filter.operands
      .map((operand) => parseBooleanFilter(tableReference, operand))
      .join(' OR ')})`;
  } else if (filter instanceof core.NotOperation) {
    return `NOT ${parseBooleanFilter(tableReference, filter.operand)}`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseLeafFilter(
  tableReference: TableReference,
  filter: core.LeafFilter,
): WhereCondition {
  const column = tableReference.table.getColumnByLeaf(filter.leaf);
  const columnDataType = column.dataType;
  const columnIdentifier = tableReference.getEscapedColumnIdentifier(column);

  if (filter instanceof core.LeafComparisonFilter) {
    const serializedColumnValue = columnDataType.serialize(filter.value);

    switch (filter.operator) {
      case 'eq':
        return `${columnIdentifier} <=> ${serializedColumnValue}`;

      case 'gt':
        return `${columnIdentifier} > ${serializedColumnValue}`;

      case 'gte':
        return `${columnIdentifier} >= ${serializedColumnValue}`;

      case 'lt':
        return `${columnIdentifier} < ${serializedColumnValue}`;

      case 'lte':
        return `${columnIdentifier} <= ${serializedColumnValue}`;

      default:
        throw new utils.UnreachableValueError(filter);
    }
  } else if (filter instanceof core.LeafFullTextFilter) {
    switch (filter.operator) {
      case 'contains':
        return column.fullTextIndex
          ? // @see https://mariadb.com/kb/en/match-against/
            `MATCH (${columnIdentifier}) AGAINST (${escapeStringValue(
              filter.value,
            )})`
          : `${columnIdentifier} LIKE ${escapeStringValue(
              `%${filter.value}%`,
            )}`;

      case 'starts_with':
        return `${columnIdentifier} LIKE ${escapeStringValue(
          `${filter.value}%`,
        )}`;

      case 'ends_with':
        return `${columnIdentifier} LIKE ${escapeStringValue(
          `%${filter.value}`,
        )}`;

      default:
        throw new utils.UnreachableValueError(filter);
    }
  } else if (filter instanceof core.LeafInFilter) {
    return `${columnIdentifier} IN (${filter.values
      .map((value) => columnDataType.serialize(value))
      .join(',')})`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseEdgeFilter(
  tableReference: TableReference,
  filter: core.EdgeFilter,
): WhereCondition {
  const foreignKey = tableReference.table.getForeignKeyByEdge(filter.edge);
  const joinTable = tableReference.join(filter.edge);

  if (filter instanceof core.EdgeExistsFilter) {
    const atLeastOneNonNullColumn = foreignKey.columns.map(
      (column) =>
        `${joinTable.getEscapedColumnIdentifier(
          column.referencedColumn,
        )} IS NOT NULL`,
    );

    const operands = [
      // An edge exists if at least one of its head's column is non-null
      atLeastOneNonNullColumn.length > 1
        ? `(${atLeastOneNonNullColumn.join(' OR ')})`
        : atLeastOneNonNullColumn[0],
      // Then we append the provided head's filter, if any
      filter.headFilter
        ? parseBooleanFilter(joinTable, filter.headFilter.filter)
        : undefined,
    ].filter(Boolean) as string[];

    return operands.length > 1 ? `(${operands.join(' AND ')})` : operands[0];
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseReverseEdgeMultipleFilter(
  tableReference: TableReference,
  filter: core.ReverseEdgeMultipleFilter,
): WhereCondition {
  if (filter instanceof core.ReverseEdgeMultipleCountFilter) {
    let operator: string;
    switch (filter.operator) {
      case 'eq':
        operator = '=';
        break;

      case 'gt':
        operator = '>';
        break;

      case 'lt':
        operator = '<';
        break;

      default:
        throw new utils.UnreachableValueError(filter.operator);
    }

    return `(${tableReference.subquery(
      'COUNT(*)',
      filter.reverseEdge,
    )}) ${operator} ${filter.value}`;
  } else if (filter instanceof core.ReverseEdgeMultipleExistsFilter) {
    return `EXISTS (${tableReference.subquery(
      '*',
      filter.reverseEdge,
      filter.headFilter,
    )})`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseReverseEdgeUniqueFilter(
  tableReference: TableReference,
  filter: core.ReverseEdgeUniqueFilter,
): WhereCondition {
  const joinTable = tableReference.join(filter.reverseEdge);
  const foreignKey = joinTable.table.getForeignKeyByEdge(
    filter.reverseEdge.originalEdge,
  );

  if (filter instanceof core.ReverseEdgeUniqueExistsFilter) {
    const atLeastOneNonNullColumn = foreignKey.columns.map(
      (column) => `${joinTable.getEscapedColumnIdentifier(column)} IS NOT NULL`,
    );

    const operands = [
      // A reverse-edge exists if at least one of its head's column is non-null
      atLeastOneNonNullColumn.length > 1
        ? `(${atLeastOneNonNullColumn.join(' OR ')})`
        : atLeastOneNonNullColumn[0],
      // Then we append the provided head's filter, if any
      filter.headFilter
        ? parseBooleanFilter(joinTable, filter.headFilter.filter)
        : undefined,
    ].filter(Boolean) as string[];

    return operands.length > 1 ? `(${operands.join(' AND ')})` : operands[0];
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseBooleanExpression(
  tableReference: TableReference,
  filter: core.BooleanExpression,
): WhereCondition {
  if (core.isLeafFilter(filter)) {
    return parseLeafFilter(tableReference, filter);
  } else if (core.isEdgeFilter(filter)) {
    return parseEdgeFilter(tableReference, filter);
  } else if (core.isReverseEdgeMultipleFilter(filter)) {
    return parseReverseEdgeMultipleFilter(tableReference, filter);
  } else if (core.isReverseEdgeUniqueFilter(filter)) {
    return parseReverseEdgeUniqueFilter(tableReference, filter);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseBooleanFilter(
  tableReference: TableReference,
  filter: core.BooleanFilter,
): WhereCondition {
  if (core.isBooleanOperation(filter)) {
    return parseBooleanOperation(tableReference, filter);
  } else if (core.isBooleanExpression(filter)) {
    return parseBooleanExpression(tableReference, filter);
  } else if (filter instanceof core.BooleanValue) {
    return filter.value ? 'TRUE' : 'FALSE';
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

export function filterNode(
  tableReference: TableReference,
  nodeFilter: core.NodeFilter,
): WhereCondition {
  assert.equal(tableReference.table.node, nodeFilter.node);

  return parseBooleanFilter(tableReference, nodeFilter.filter);
}
