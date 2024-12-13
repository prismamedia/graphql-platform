import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { TableReference } from './table-reference.js';

/**
 * @see https://mariadb.com/kb/en/select/#select-expressions
 */
export function orderNode(
  tableReference: TableReference,
  nodeOrdering: core.NodeOrdering,
): string {
  assert.strictEqual(tableReference.table.node, nodeOrdering.node);

  return nodeOrdering.expressions
    .map((expression) => {
      const direction =
        expression.direction === core.OrderingDirection.ASCENDING
          ? 'ASC'
          : 'DESC';

      if (expression instanceof core.LeafOrdering) {
        return `${tableReference.getEscapedColumnIdentifierByLeaf(
          expression.leaf,
        )} ${direction}`;
      } else if (expression instanceof core.MultipleReverseEdgeCountOrdering) {
        return `${tableReference.subquery(
          expression.reverseEdge,
          'COUNT(*)',
        )} ${direction}`;
      } else {
        throw new utils.UnreachableValueError(expression);
      }
    })
    .join(', ');
}
