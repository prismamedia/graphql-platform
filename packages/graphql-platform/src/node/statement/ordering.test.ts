import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { ArticleStatus, createMyGP } from '../../__tests__/config.js';
import type { OrderByInputValue } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeSetDependencyGraph,
  NodeUpdate,
  type DependencySummaryJSON,
} from '../change.js';
import type { NodeOrdering } from './ordering.js';

describe('Ordering', () => {
  const gp = createMyGP();

  const Article = gp.getNodeByName('Article');
  const ArticleTag = gp.getNodeByName('ArticleTag');

  describe('Definition', () => {
    (
      [
        [
          ['createdAt_DESC'],
          {
            creations: ['Article'],
            deletions: ['Article'],
            changes: ['Article'],
          },
        ],
        [
          ['tagCount_DESC'],
          {
            creations: ['Article', 'ArticleTag'],
            deletions: ['Article', 'ArticleTag'],
            changes: ['Article', 'ArticleTag'],
          },
        ],
        [
          ['createdAt_DESC', 'tagCount_DESC'],
          {
            creations: ['Article', 'ArticleTag'],
            deletions: ['Article', 'ArticleTag'],
            changes: ['Article', 'ArticleTag'],
          },
        ],
      ] satisfies [OrderByInputValue, DependencySummaryJSON][]
    ).forEach(([input, expected]) => {
      it(`${input}.dependency`, () => {
        const dependency = new NodeSetDependencyGraph(
          Article,
          undefined,
          Article.orderingInputType.sort(input),
        );

        assert.deepEqual(dependency.summary.toJSON(), expected);
      });
    });
  });

  describe('Execution', () => {
    describe("Node-changes' effect", () => {
      let ordering: NodeOrdering;
      let dependency: NodeSetDependencyGraph;

      before(() => {
        ordering = Article.orderingInputType.sort([
          'createdAt_DESC',
          'tagCount_DESC',
        ]);

        dependency = new NodeSetDependencyGraph(Article, undefined, ordering);
      });

      describe('Article', () => {
        it('The updated "slug" changes nothing', () => {
          const update = NodeUpdate.createFromPartial(
            Article,
            {},
            {
              _id: 5,
              id: 'aeb49c83-ee71-4662-bf5e-4ea53a6ae150',
              status: ArticleStatus.DRAFT,
              title: 'My test article',
              slug: 'my-test-article',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
              views: 0,
              score: 0,
            },
            {
              slug: 'my-new-test-article',
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });
      });

      describe('ArticleTag', () => {
        it('The creation changes the root', () => {
          const creation = NodeCreation.createFromPartial(
            ArticleTag,
            {},
            {
              article: { _id: 2 },
              tag: { id: '4f2b2a03-7d62-4474-a497-d274639e90f3' },
              order: 2,
            },
          );

          const dependentGraph = dependency.createDependentGraph(creation);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            _id: 2,
          });
        });

        it('The deletion changes the root', () => {
          const deletion = NodeDeletion.createFromPartial(
            ArticleTag,
            {},
            {
              article: { _id: 3 },
              tag: { id: '99ece8fe-68d8-4223-bd91-c0471b378984' },
              order: 3,
            },
          );

          const dependentGraph = dependency.createDependentGraph(deletion);

          assert(!dependentGraph.isEmpty());
        });

        it('The updated "order" changes nothing', () => {
          const update = NodeUpdate.createFromPartial(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              tag: { id: '3152ee02-2e8e-4734-9b30-5f92e2673839' },
              order: 4,
            },
            {
              order: 5,
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });
      });
    });
  });
});
