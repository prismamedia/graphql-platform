import { beforeAll, describe, expect, it } from '@jest/globals';
import { GraphQLEnumType, printType } from 'graphql';
import { GraphQLPlatform } from '../../../index.js';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import {
  OrderingDirection,
  OrderingExpression,
} from '../../statement/ordering.js';
import { NodeOrderingInputType, OrderByInputValue } from './ordering.js';

describe('NodeOrderingInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has an ordering input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const orderingInputType = node.orderingInputType;
      expect(orderingInputType).toBeInstanceOf(NodeOrderingInputType);

      if (orderingInputType.isPublic()) {
        expect(orderingInputType.getGraphQLInputType()).toBeInstanceOf(
          GraphQLEnumType,
        );
        expect(
          printType(orderingInputType.getGraphQLInputType()),
        ).toMatchSnapshot(orderingInputType.name);
      } else {
        expect(() => orderingInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}OrderingInput" input type is private`,
        );
      }
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          ['_id_DESCS'],
          '/0 - Expects a value among "_id_ASC, _id_DESC, createdAt_ASC, createdAt_DESC, updatedAt_ASC, updatedAt_DESC, views_ASC, views_DESC, score_ASC, score_DESC, tagCount_ASC, tagCount_DESC", got: \'_id_DESCS\'',
        ],
      ])(
        'throws an Error on %sOrderingInput.sort(%p)',
        (nodeName, input, error) => {
          const node = gp.getNodeByName(nodeName);
          const orderingInputType = node.orderingInputType;

          expect(() => orderingInputType.sort(input)).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it.each<
        [
          string,
          OrderByInputValue,
          ReadonlyArray<OrderingExpression['ast']> | undefined,
        ]
      >([
        ['Article', undefined, undefined],
        ['Article', null, undefined],
        ['Article', [], undefined],
        [
          'Article',
          ['createdAt_ASC'],
          [
            {
              kind: 'LeafOrdering',
              leaf: 'createdAt',
              direction: OrderingDirection.ASCENDING,
            },
          ],
        ],
        [
          'Article',
          ['tagCount_DESC', 'updatedAt_ASC'],
          [
            {
              kind: 'MultipleReverseEdgeCountOrdering',
              reverseEdge: 'tags',
              direction: OrderingDirection.DESCENDING,
            },
            {
              kind: 'LeafOrdering',
              leaf: 'updatedAt',
              direction: OrderingDirection.ASCENDING,
            },
          ],
        ],
      ])('%sOrderingInput.sort(%p)', (nodeName, input, expressions) => {
        const node = gp.getNodeByName(nodeName);
        const orderingInputType = node.orderingInputType;

        expect(
          orderingInputType.sort(input).normalized?.ast.expressions,
        ).toEqual(expressions);
      });
    });
  });
});
