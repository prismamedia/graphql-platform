import assert from 'node:assert';
import { describe, it } from 'node:test';
import { createMyGP } from '../../__tests__/config.js';
import type {
  FlattenedNodeDependencyTreeJSON,
  OrderByInputValue,
} from '../../node.js';

describe('Ordering', () => {
  const gp = createMyGP();

  const Article = gp.getNodeByName('Article');

  describe('Definition', () => {
    (
      [
        [['createdAt_DESC'], {}],
        [
          ['tagCount_DESC'],
          {
            ArticleTag: {
              creation: true,
              deletion: true,
            },
          },
        ],
        [
          ['createdAt_DESC', 'tagCount_DESC'],
          {
            ArticleTag: {
              creation: true,
              deletion: true,
            },
          },
        ],
      ] satisfies [OrderByInputValue, FlattenedNodeDependencyTreeJSON][]
    ).forEach(([input, expected]) => {
      it(`${input}.dependency`, () => {
        assert.deepEqual(
          Article.orderingInputType
            .sort(input)
            .dependencyTree.flattened.toJSON(),
          expected,
        );
      });
    });
  });
});
