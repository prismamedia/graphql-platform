import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { type MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
import { NodeOrderingInputType, type OrderByInputValue } from './ordering.js';

describe('NodeOrderingInputType', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} has an ordering input type`, ({
        assert: { snapshot },
      }) => {
        const node = gp.getNodeByName(nodeName);

        const orderingInputType = node.orderingInputType;
        assert(orderingInputType instanceof NodeOrderingInputType);

        if (orderingInputType.isPublic()) {
          assert(
            orderingInputType.getGraphQLInputType() instanceof
              graphql.GraphQLEnumType,
          );

          snapshot(graphql.printType(orderingInputType.getGraphQLInputType()));
        } else {
          assert.throws(() => orderingInputType.getGraphQLInputType(), {
            message: `The "${nodeName}OrderingInput" input type is private`,
          });
        }
      });
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      (
        [
          [
            'Article',
            ['_id_DESCS'],
            '/0 - Expects a value among "_id_ASC, _id_DESC, createdAt_ASC, createdAt_DESC, updatedAt_ASC, updatedAt_DESC, views_ASC, views_DESC, score_ASC, score_DESC, tagCount_ASC, tagCount_DESC", got: \'_id_DESCS\'',
          ],
        ] as const
      ).forEach(([nodeName, input, error]) => {
        it(`${nodeName}OrderingInput.sort(${inspect(input, undefined, 5)}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);
          const orderingInputType = node.orderingInputType;

          assert.throws(() => orderingInputType.sort(input as any), {
            message: error,
          });
        });
      });
    });

    describe('Works', () => {
      (
        [
          ['Article', undefined, undefined],
          ['Article', null, undefined],
          ['Article', [], undefined],
          ['Article', ['createdAt_ASC'], ['createdAt_ASC']],
          [
            'Article',
            ['tagCount_DESC', 'updatedAt_ASC'],
            ['tagCount_DESC', 'updatedAt_ASC'],
          ],
          ['Article', ['_id_ASC'], ['_id_ASC']],
        ] as [string, OrderByInputValue, OrderByInputValue][]
      ).forEach(([nodeName, input, output]) => {
        it(`${nodeName}OrderingInput.sort(${inspect(input, undefined, 5)})`, () => {
          const node = gp.getNodeByName(nodeName);
          const orderingInputType = node.orderingInputType;

          assert.deepEqual(
            orderingInputType.sort(input as any).normalized?.inputValue,
            output,
          );
        });
      });
    });
  });
});
