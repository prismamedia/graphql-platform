import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { TableReference } from './table-reference.js';

export type OrderingExpression = string;

/**
 * @see https://mariadb.com/kb/en/select/#select-expressions
 */
export function orderNode(
  tableReference: TableReference,
  nodeOrdering: core.NodeOrdering,
): OrderingExpression[] {
  assert.strictEqual(tableReference.table.node, nodeOrdering.node);

  return nodeOrdering.expressions.map((expression) => {
    const direction =
      expression.direction === core.OrderingDirection.ASCENDING
        ? 'ASC'
        : 'DESC';

    if (expression instanceof core.LeafOrdering) {
      return `${tableReference.escapeColumnIdentifierByLeaf(
        expression.leaf,
      )} ${direction}`;
    } else if (expression instanceof core.MultipleReverseEdgeCountOrdering) {
      return `${tableReference.subquery(expression.reverseEdge, {
        select: 'COUNT(*)',
      })} ${direction}`;
    } else if (expression instanceof core.AbstractOrderingExpression) {
      // TODO: Allow the handling of custom expressions
      throw new utils.UnexpectedValueError(
        `a supported-expression`,
        expression,
      );
    } else {
      throw new utils.UnreachableValueError(expression);
    }
  });
}
