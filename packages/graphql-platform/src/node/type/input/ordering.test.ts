import { addPath } from '@prismamedia/graphql-platform-utils';
import { GraphQLEnumType, printType } from 'graphql';
import { GraphQLPlatform } from '../../../index.js';
import {
  MyGP,
  myVisitorContext,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { OperationContext } from '../../operation/context.js';
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
      const node = gp.getNode(nodeName);

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
          myVisitorContext,
          '"ArticleOrderingInput.0" - Expects a value among "_id_ASC, _id_DESC, createdAt_ASC, createdAt_DESC, updatedAt_ASC, updatedAt_DESC, tagCount_ASC, tagCount_DESC", got: \'_id_DESCS\'',
        ],
        [
          'Article',
          ['_id_DESC', 'tagCount_DESC'],
          myVisitorContext,
          '"ArticleOrderingInput.1.tagCount_DESC" - Unauthorized access to "ArticleTag"',
        ],
      ])(
        'throws an Error on %sOrderingInput.sort(%p)',
        (nodeName, input, requestContext, error) => {
          const node = gp.getNode(nodeName);
          const orderingInputType = node.orderingInputType;

          expect(() =>
            orderingInputType.sort(
              input,
              new OperationContext(gp, requestContext),
              addPath(undefined, orderingInputType.name),
            ),
          ).toThrowError(error);
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
              kind: 'ReverseEdgeMultipleCountOrdering',
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
        const node = gp.getNode(nodeName);
        const orderingInputType = node.orderingInputType;

        expect(
          orderingInputType.sort(
            input,
            undefined,
            addPath(undefined, orderingInputType.name),
          ).normalized?.ast.expressions,
        ).toEqual(expressions);
      });
    });
  });
});
