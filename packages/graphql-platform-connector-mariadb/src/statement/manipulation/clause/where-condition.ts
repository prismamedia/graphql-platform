import * as core from '@prismamedia/graphql-platform';
import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import { escapeStringValue } from '../../../escaping.js';
import { LeafColumn, type ReferenceColumnTree } from '../../../schema.js';
import type { TableReference } from './table-reference.js';

export type WhereCondition = string;

export function AND(
  maybeConditions: ReadonlyArray<utils.Nillable<WhereCondition>>,
): WhereCondition {
  const conditions = maybeConditions.filter(utils.isNonNil);

  return conditions.length > 1
    ? `(${conditions.join(' AND ')})`
    : conditions.length === 1
      ? conditions[0]
      : 'TRUE';
}

export function OR(
  maybeConditions: ReadonlyArray<utils.Nillable<WhereCondition>>,
): WhereCondition {
  const conditions = maybeConditions.filter(utils.isNonNil);

  return conditions.length > 1
    ? `(${conditions.join(' OR ')})`
    : conditions.length === 1
      ? conditions[0]
      : 'FALSE';
}

function parseBooleanOperation(
  tableReference: TableReference,
  filter: core.BooleanOperation,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  if (filter instanceof core.AndOperation) {
    return AND(
      filter.operands.map((operand) =>
        parseBooleanFilter(tableReference, operand, referenceColumnTree),
      ),
    );
  } else if (filter instanceof core.OrOperation) {
    return OR(
      filter.operands.map((operand) =>
        parseBooleanFilter(tableReference, operand, referenceColumnTree),
      ),
    );
  } else if (filter instanceof core.NotOperation) {
    return `NOT ${parseBooleanFilter(tableReference, filter.operand)}`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseLeafFilter(
  tableReference: TableReference,
  filter: core.LeafFilter,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  const column =
    referenceColumnTree?.getColumnByLeaf(filter.leaf) ??
    tableReference.table.getColumnByLeaf(filter.leaf);

  const columnDataType = column.dataType;
  const columnIdentifier = tableReference.getEscapedColumnIdentifier(column);

  if (filter instanceof core.LeafComparisonFilter) {
    const serializedColumnValue = columnDataType.serialize(filter.value);

    switch (filter.operator) {
      case 'eq':
        return filter.value === null
          ? `${columnIdentifier} IS NULL`
          : `${columnIdentifier} = ${serializedColumnValue}`;

      case 'not':
        return filter.value === null
          ? `${columnIdentifier} IS NOT NULL`
          : column.isNullable()
            ? OR([
                `${columnIdentifier} IS NULL`,
                `${columnIdentifier} != ${serializedColumnValue}`,
              ])
            : `${columnIdentifier} != ${serializedColumnValue}`;

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
        return column instanceof LeafColumn && column.fullTextIndex
          ? // @see https://mariadb.com/kb/en/match-against/
            `MATCH (${columnIdentifier}) AGAINST (${escapeStringValue(
              filter.value,
            )} IN BOOLEAN MODE)`
          : filter.leaf.type === scalars.typesByName.DraftJS
            ? `JSON_SEARCH(${columnIdentifier}, 'one', ${escapeStringValue(
                `%${filter.value}%`,
              )}, NULL, '$.blocks[*].text') IS NOT NULL`
            : `${columnIdentifier} LIKE ${escapeStringValue(
                `%${filter.value}%`,
              )}`;

      case 'starts_with':
        return filter.leaf.type === scalars.typesByName.DraftJS
          ? `JSON_SEARCH(${columnIdentifier}, 'one', ${escapeStringValue(
              `${filter.value}%`,
            )}, NULL, '$.blocks[0].text') IS NOT NULL`
          : `${columnIdentifier} LIKE ${escapeStringValue(`${filter.value}%`)}`;

      case 'ends_with':
        return filter.leaf.type === scalars.typesByName.DraftJS
          ? `JSON_SEARCH(${columnIdentifier}, 'one', ${escapeStringValue(
              `%${filter.value}`,
            )}, NULL, '$.blocks[last].text') IS NOT NULL`
          : `${columnIdentifier} LIKE ${escapeStringValue(`%${filter.value}`)}`;

      default:
        throw new utils.UnreachableValueError(filter);
    }
  } else if (filter instanceof core.LeafInFilter) {
    return `${columnIdentifier} IN (${filter.values
      .map((value) => columnDataType.serialize(value))
      .join(',')})`;
  } else if (filter instanceof core.AbstractLeafFilter) {
    // TODO: Allow the handling of custom leaf-filters
    throw new utils.UnexpectedValueError(`a supported-expression`, filter);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseEdgeFilter(
  tableReference: TableReference,
  filter: core.EdgeFilter,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  const edge = filter.edge;

  if (filter instanceof core.EdgeExistsFilter) {
    if (referenceColumnTree) {
      const subTree = referenceColumnTree.getColumnTreeByEdge(edge);

      return AND([
        edge.isNullable()
          ? OR(
              subTree.columns.map(
                (column) =>
                  `${tableReference.getEscapedColumnIdentifier(
                    column,
                  )} IS NOT NULL`,
              ),
            )
          : undefined,
        filter.headFilter
          ? filterNode(tableReference, filter.headFilter, subTree)
          : undefined,
      ]);
    }

    const headAuthorization = tableReference.context.getAuthorization(
      edge.head,
    );

    const mergedHeadAuthorizationAndHeadFilter =
      headAuthorization && filter.headFilter
        ? headAuthorization.and(filter.headFilter).normalized
        : headAuthorization || filter.headFilter;

    return AND([
      edge.isNullable()
        ? OR(
            tableReference.table
              .getForeignKeyByEdge(edge)
              .columns.map(
                (column) =>
                  `${tableReference.getEscapedColumnIdentifier(
                    column,
                  )} IS NOT NULL`,
              ),
          )
        : undefined,
      mergedHeadAuthorizationAndHeadFilter
        ? mergedHeadAuthorizationAndHeadFilter.isExecutableWithinUniqueConstraint(
            edge.referencedUniqueConstraint,
          )
          ? filterNode(
              tableReference,
              mergedHeadAuthorizationAndHeadFilter,
              tableReference.table.getColumnTreeByEdge(edge),
            )
          : `EXISTS ${tableReference.subquery(edge, '*', filter.headFilter)}`
        : undefined,
    ]);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseComponentFilter(
  tableReference: TableReference,
  filter: core.ComponentFilter,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  if (core.isLeafFilter(filter)) {
    return parseLeafFilter(tableReference, filter, referenceColumnTree);
  } else if (core.isEdgeFilter(filter)) {
    return parseEdgeFilter(tableReference, filter, referenceColumnTree);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseUniqueReverseEdgeFilter(
  tableReference: TableReference,
  filter: core.UniqueReverseEdgeFilter,
): WhereCondition {
  if (filter instanceof core.UniqueReverseEdgeExistsFilter) {
    return `EXISTS ${tableReference.subquery(
      filter.reverseEdge,
      '*',
      filter.headFilter,
    )}`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseMultipleReverseEdgeFilter(
  tableReference: TableReference,
  filter: core.MultipleReverseEdgeFilter,
): WhereCondition {
  if (filter instanceof core.MultipleReverseEdgeCountFilter) {
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

    return `${tableReference.subquery(
      filter.reverseEdge,
      'COUNT(*)',
    )} ${operator} ${filter.value}`;
  } else if (filter instanceof core.MultipleReverseEdgeExistsFilter) {
    return `EXISTS ${tableReference.subquery(
      filter.reverseEdge,
      '*',
      filter.headFilter,
    )}`;
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseReverseEdgeFilter(
  tableReference: TableReference,
  filter: core.ReverseEdgeFilter,
): WhereCondition {
  if (core.isUniqueReverseEdgeFilter(filter)) {
    return parseUniqueReverseEdgeFilter(tableReference, filter);
  } else if (core.isMultipleReverseEdgeFilter(filter)) {
    return parseMultipleReverseEdgeFilter(tableReference, filter);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseBooleanExpression(
  tableReference: TableReference,
  filter: core.BooleanExpression,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  if (core.isComponentFilter(filter)) {
    return parseComponentFilter(tableReference, filter, referenceColumnTree);
  } else if (core.isReverseEdgeFilter(filter)) {
    return parseReverseEdgeFilter(tableReference, filter);
  } else if (filter instanceof core.AbstractBooleanExpression) {
    // TODO: Allow the handling of custom boolean-expressions
    throw new utils.UnexpectedValueError(`a supported-expression`, filter);
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

function parseBooleanFilter(
  tableReference: TableReference,
  filter: core.BooleanFilter,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  if (core.isBooleanOperation(filter)) {
    return parseBooleanOperation(tableReference, filter, referenceColumnTree);
  } else if (core.isBooleanExpression(filter)) {
    return parseBooleanExpression(tableReference, filter, referenceColumnTree);
  } else if (filter instanceof core.BooleanValue) {
    return filter.value ? 'TRUE' : 'FALSE';
  } else {
    throw new utils.UnreachableValueError(filter);
  }
}

export function filterNode(
  tableReference: TableReference,
  nodeFilter: core.NodeFilter,
  referenceColumnTree?: ReferenceColumnTree,
): WhereCondition {
  referenceColumnTree
    ? assert.equal(referenceColumnTree.currentEdge.head, nodeFilter.node)
    : assert.equal(tableReference.table.node, nodeFilter.node);

  return parseBooleanFilter(
    tableReference,
    nodeFilter.filter,
    referenceColumnTree,
  );
}
