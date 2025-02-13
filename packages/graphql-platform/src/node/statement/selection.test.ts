import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  ArticleStatus,
  createMyGP,
  myAdminContext,
} from '../../__tests__/config.js';
import type { RawNodeSelection } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeSetDependencyGraph,
  NodeUpdate,
  type DependencySummaryJSON,
} from '../change.js';
import { OperationContext } from '../operation.js';
import { NodeSelection } from './selection.js';

describe('Selection', () => {
  const gp = createMyGP();

  const Article = gp.getNodeByName('Article');
  const ArticleTag = gp.getNodeByName('ArticleTag');
  const Category = gp.getNodeByName('Category');
  const Tag = gp.getNodeByName('Tag');
  const User = gp.getNodeByName('User');
  const UserProfile = gp.getNodeByName('UserProfile');

  describe('Definition', () => {
    (
      [
        [
          `{ title }`,
          { componentsByNode: { Article: ['title'] }, changes: ['Article'] },
        ],
        [
          `{ title category { title order } }`,
          {
            componentsByNode: {
              Article: ['title', 'category'],
              Category: ['order'],
            },
            changes: ['Article', 'Category'],
          },
        ],
        [
          `{ tagCount }`,
          {
            creations: ['ArticleTag'],
            deletions: ['ArticleTag'],
            changes: ['ArticleTag'],
          },
        ],
        [
          `{ tags(where: { tag: { deprecated_not: true }}, orderBy: [order_ASC], first: 10) { tag { slug }}}`,
          {
            creations: ['ArticleTag'],
            deletions: ['ArticleTag'],
            componentsByNode: { ArticleTag: ['order'], Tag: ['deprecated'] },
            changes: ['ArticleTag', 'Tag'],
          },
        ],
      ] satisfies [RawNodeSelection, DependencySummaryJSON][]
    ).forEach(([input, expected]) => {
      it(`${input}.dependency = ${expected}`, () => {
        assert.deepEqual(
          Article.outputType.select(input).dependencyGraph?.summary.toJSON(),
          expected,
        );
      });
    });
  });

  describe('Execution', () => {
    (
      [
        [
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: null,
            },
            b: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: null,
            },
          },
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: 'draft-my title',
            b: 'draft-my title',
          },
        ],
        [
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: { title: 'My category' },
            },
            b: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: { title: 'My category' },
            },
          },
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: 'draft-my title-my category',
            b: 'draft-my title-my category',
          },
        ],
      ] as const
    ).forEach(([source, value]) => {
      it(`Parses & resolves`, async () => {
        const selection = Article.outputType.select(`{
          id
          status
          a: lowerCasedTitle
          b: lowerCasedTitle
        }`);

        assert.deepEqual(selection.parseSource(source), source);

        assert.deepEqual(
          await selection.resolveValue(
            source,
            new OperationContext(gp, myAdminContext),
          ),
          value,
        );
      });
    });

    describe("Node-changes' effect", () => {
      let selection: NodeSelection;
      let dependency: NodeSetDependencyGraph;

      before(() => {
        selection = Article.outputType.select(`{
          id
          title
          extension {
            source
          }
          category {
            order
            title
            parent {
              order
              title
            }
          }
          createdBy {
            username
            profile {
              facebookId
            }
            createdArticles(orderBy: [createdAt_DESC], first: 5) {
              title
            }
          }
          updatedBy {
            username
            profile {
              facebookId
            }
            updatedArticles(orderBy: [updatedAt_DESC], first: 5) {
              title
            }
          }
          tagCount(where: { order_gt: 0, tag: { deprecated_not: true }})
        }`);

        dependency = new NodeSetDependencyGraph(
          Article,
          undefined,
          undefined,
          selection,
        );
      });

      describe('Article', () => {
        it('The updated "slug" changes nothing', () => {
          const update = new NodeUpdate(
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
            { slug: 'my-new-test-article' },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });

        it('The updated "title" changes the root', () => {
          const update = new NodeUpdate(
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
            { title: 'My new test article' },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 1);
          assert(dependentGraph.graphFilter.isFalse());
        });

        it('The updated "title" changes the root and the graph', () => {
          const update = new NodeUpdate(
            Article,
            {},
            {
              _id: 5,
              id: 'aeb49c83-ee71-4662-bf5e-4ea53a6ae150',
              status: ArticleStatus.DRAFT,
              title: 'My test article',
              slug: 'my-test-article',
              createdBy: { id: '9121c47b-87b6-4334-ae1d-4c9777e87576' },
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedBy: { username: 'yvann' },
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
              views: 0,
              score: 0,
            },
            { title: 'My new test article' },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 1);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            OR: [
              { createdBy: { id: '9121c47b-87b6-4334-ae1d-4c9777e87576' } },
              { updatedBy: { username: 'yvann' } },
            ],
          });
        });

        it('The updated "updatedAt" changes the graph', () => {
          const update = new NodeUpdate(
            Article,
            {},
            {
              _id: 5,
              id: 'aeb49c83-ee71-4662-bf5e-4ea53a6ae150',
              status: ArticleStatus.DRAFT,
              title: 'My test article',
              slug: 'my-test-article',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedBy: { username: 'yvann' },
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
              views: 0,
              score: 0,
            },
            { updatedAt: new Date('2021-06-01T00:00:00.000Z') },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            updatedBy: { username: 'yvann' },
          });
        });
      });

      describe('Category', () => {
        it('The updated "order" changes the graph', () => {
          const update = new NodeUpdate(
            Category,
            {},
            {
              _id: 10,
              id: 'b779d46f-b364-455a-83a8-4284077a9b18',
              order: 0,
              title: 'My test category',
              slug: 'my-test-category',
            },
            { order: 1 },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            category: { OR: [{ _id: 10 }, { parent: { _id: 10 } }] },
          });
        });

        it('The updated "parent" changes the graph', () => {
          const update = new NodeUpdate(
            Category,
            {},
            {
              _id: 10,
              id: 'b779d46f-b364-455a-83a8-4284077a9b18',
              order: 0,
              title: 'My test category',
              slug: 'my-test-category',
            },
            { parent: { _id: 20 } },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            category: { _id: 10 },
          });
        });
      });

      describe('User', () => {
        it('The updated "lastLoggedInAt" changes nothing', () => {
          const update = new NodeUpdate(
            User,
            {},
            {
              id: '42d6a939-31d7-47f4-b186-32c838d11f40',
              username: 'yvann',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            { lastLoggedInAt: new Date() },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });
      });

      describe('UserProfile', () => {
        it('The creation changes the graph', () => {
          const creation = new NodeCreation(
            UserProfile,
            {},
            { user: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
          );

          const dependentGraph = dependency.createDependentGraph(creation);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            OR: [
              { createdBy: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
              { updatedBy: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
            ],
          });
        });

        it('The deletion changes nothing', () => {
          const deletion = new NodeDeletion(
            UserProfile,
            {},
            { user: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
          );

          const dependentGraph = dependency.createDependentGraph(deletion);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            OR: [
              { createdBy: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
              { updatedBy: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
            ],
          });
        });

        it('The updated "birthday" changes nothing', () => {
          const update = new NodeUpdate(
            UserProfile,
            {},
            { user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
            { birthday: '1987-04-28' },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });

        it('The updated "facebookId" changes the graph', () => {
          const update = new NodeUpdate(
            UserProfile,
            {},
            { user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
            { facebookId: 'a-facebook-id' },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            OR: [
              { createdBy: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
              { updatedBy: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
            ],
          });
        });
      });

      describe('ArticleTag', () => {
        it('The creation changes the graph', () => {
          const creation = new NodeCreation(
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
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, { _id: 2 });
        });

        it('The deletion changes the graph', () => {
          const deletion = new NodeDeletion(
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
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, { _id: 3 });
        });

        it('The updated "order", from 4 to 0, changes the graph', () => {
          const update = new NodeUpdate(
            ArticleTag,
            {},
            {
              article: { _id: 4 },
              tag: { id: '764d2d19-c1da-41f4-8c31-f0fd0aa911df' },
              order: 4,
            },
            { order: 0 },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, { _id: 4 });
        });

        it('The updated "order", from 4 to 5, changes nothing', () => {
          const update = new NodeUpdate(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              tag: { id: '3152ee02-2e8e-4734-9b30-5f92e2673839' },
              order: 4,
            },
            { order: 5 },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, { _id: 5 });
        });
      });

      describe('Tag', () => {
        it('The updated "deprecated", from NULL to TRUE, changes the graph', () => {
          const update = new NodeUpdate(
            Tag,
            {},
            {
              id: '68f3d88d-1308-4019-8118-fc20042e8c20',
              title: 'My tag',
              slug: 'my-tag',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            { deprecated: true },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            tags_some: { tag: { id: '68f3d88d-1308-4019-8118-fc20042e8c20' } },
          });
        });

        it('The updated "deprecated", from NULL to FALSE, changes nothing', () => {
          const update = new NodeUpdate(
            Tag,
            {},
            {
              id: '68f3d88d-1308-4019-8118-fc20042e8c20',
              title: 'My tag',
              slug: 'my-tag',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            { deprecated: false },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.strictEqual(dependentGraph.changes.size, 0);
          assert.deepEqual(dependentGraph.graphFilter.inputValue, {
            tags_some: { tag: { id: '68f3d88d-1308-4019-8118-fc20042e8c20' } },
          });
        });
      });
    });
  });
});
