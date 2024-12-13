import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import type { Node, UniqueConstraint } from '../../node.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeSetDependencyGraph,
  NodeUpdate,
  type DependencySummaryJSON,
  type NodeDependencyGraph,
} from '../change.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';
import type { NodeFilter } from './filter.js';

describe('Filter', () => {
  let gp: MyGP;

  let Article: Node;
  let ArticleExtension: Node;
  let UserProfile: Node;

  before(() => {
    gp = createMyGP();

    Article = gp.getNodeByName('Article');
    ArticleExtension = gp.getNodeByName('ArticleExtension');
    UserProfile = gp.getNodeByName('UserProfile');
  });

  describe('Definition', () => {
    (
      [
        ['Article', { title_contains: 'newss' }, '_id', false],
        ['Article', { _id: 5 }, '_id', true],
        ['Article', { OR: [{ _id: 5 }, { _id_gt: 6 }] }, '_id', true],
      ] satisfies [
        nodeName: string,
        filter: NodeFilterInputValue,
        uniqueName: UniqueConstraint['name'],
        expected: boolean,
      ][]
    ).forEach(([nodeName, filter, uniqueName, expected], index) => {
      it(`${index} - ${nodeName}.filter(${inspect(filter, undefined, 5)}).isExecutableWithinUniqueConstraint(${uniqueName})`, () => {
        const node = gp.getNodeByName(nodeName);
        const unique = node.getUniqueConstraintByName(uniqueName);

        assert.strictEqual(
          node.filterInputType
            .parseAndFilter(filter)
            .isExecutableWithinUniqueConstraint(unique),
          expected,
        );
      });
    });

    (
      [
        ['Article', undefined, '{}'],
        ['Article', null, 'null'],
        ['Article', { _id_gt: 4, _id_lt: 8 }, '{_id_gt: 4, _id_lt: 8}'],
        ['Article', { status: ArticleStatus.PUBLISHED }, '{status: PUBLISHED}'],
        ['Article', { views_gt: BigInt(123456) }, '{views_gt: "123456"}'],
        ['Article', { score_gte: 0.5 }, '{score_gte: 0.5}'],
        ['Article', { category: {} }, '{category: {}}'],
      ] satisfies [
        nodeName: string,
        input: NodeFilterInputValue,
        expected: string,
      ][]
    ).forEach(([nodeName, input, expected], index) => {
      it(`${index} - ${nodeName}.filter(${inspect(input, undefined, 5)})`, () => {
        const node = gp.getNodeByName(nodeName);
        const filterInputType = node.filterInputType;
        const filter = filterInputType.parseAndFilter(input);

        assert.strictEqual(String(filter), expected);
      });
    });

    (
      [
        ['Article', { _id_gt: 4, _id_lt: 8 }, { changes: [] }],
        [
          'Article',
          { category: {} },
          {
            componentsByNode: { Article: ['category'] },
            changes: ['Article'],
          },
        ],
        [
          'Article',
          { tags_some: { tag: { deprecated_not: true } } },
          {
            creations: ['ArticleTag'],
            deletions: ['ArticleTag'],
            componentsByNode: { Tag: ['deprecated'] },
            changes: ['ArticleTag', 'Tag'],
          },
        ],
      ] satisfies [
        nodeName: string,
        input: NodeFilterInputValue,
        expected: DependencySummaryJSON,
      ][]
    ).forEach(([nodeName, input, expected], index) => {
      it(`${index} - ${nodeName}.dependency`, () => {
        const node = gp.getNodeByName(nodeName);
        const filter = node.filterInputType.parseAndFilter(input);

        assert.deepEqual(filter.dependencyGraph.summary.toJSON(), expected);
      });
    });
  });

  describe('Execution', () => {
    (
      [
        ['ArticleTag', { order_gt: 2 }, {}, undefined],
        ['ArticleTag', { order_gt: 2 }, { order: 2 }, false],
        ['ArticleTag', { order_gte: 2 }, { order: 2 }, true],

        ['Article', { title_contains: 'newss' }, { title: 'The news' }, false],
        ['Article', { title_contains: 'news' }, { title: 'The news' }, true],

        [
          'Article',
          { title_starts_with: 'Thes' },
          { title: 'The news' },
          false,
        ],
        ['Article', { title_starts_with: 'The' }, { title: 'The news' }, true],

        ['Article', { title_ends_with: 'newss' }, { title: 'The news' }, false],
        ['Article', { title_ends_with: 'news' }, { title: 'The news' }, true],
        [
          'Article',
          { AND: [{ title_starts_with: 'The' }, { title_ends_with: 'news' }] },
          { title: 'The news' },
          true,
        ],
      ] satisfies [
        nodeName: string,
        filter: NodeFilterInputValue,
        value: any,
        expected: boolean | undefined,
      ][]
    ).forEach(([nodeName, filter, value, expected], index) => {
      it(`${index} - ${nodeName}.filter(${inspect(filter, undefined, 5)}).execute(${inspect(value, undefined, 5)}, true) = ${expected}`, () => {
        const node = gp.getNodeByName(nodeName);

        assert.strictEqual(
          node.filterInputType.parseAndFilter(filter).execute(value, true),
          expected,
        );
      });
    });

    describe("Node-changes' effect", () => {
      let filter: NodeFilter;
      let dependency: NodeDependencyGraph;

      before(() => {
        filter = Article.filterInputType.parseAndFilter({
          title: 'My title',
          extension_is_null: false,
          category: {
            parent: {
              title: "My category's title",
            },
          },
          createdBy: {
            profile: {
              facebookId: 'my-facebook-id',
            },
            createdArticles_some: {
              title: "My created article's title",
            },
          },
          updatedBy: {
            profile: {
              twitterHandle: 'my-twitter-handle',
            },
            updatedArticles_some: {
              title: "My updated article's title",
            },
          },
        });

        dependency = new NodeSetDependencyGraph(Article, filter);
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

        it('The updated "title" changes the root', () => {
          {
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
                title: 'My other title',
              },
            );

            const dependentGraph = dependency.createDependentGraph(update);

            assert(dependentGraph.isEmpty());
          }

          {
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
                title: 'My title',
                category: { _id: 5 },
                createdBy: { id: '9604da92-1542-4443-bd67-0cfd26a90e5d' },
                updatedBy: { username: 'yvann' },
              },
            );

            const dependentGraph = dependency.createDependentGraph(update);

            assert(!dependentGraph.isEmpty());
            assert.strictEqual(dependentGraph.changes.size, 1);
            assert(dependentGraph.target.isFalse());
          }
        });

        it('The updated "title" changes nothing if there is no "createdBy"', () => {
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
              title: "My created article's title",
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });

        it('The updated "title" changes the graph if there is a "createdBy"', () => {
          const update = NodeUpdate.createFromPartial(
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
            {
              title: "My created article's title",
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            createdBy: {
              id: '9121c47b-87b6-4334-ae1d-4c9777e87576',
            },
          });
        });

        it('The updated "title" changes nothing if there is no "updatedBy"', () => {
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
              title: "My updated article's title",
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });

        it('The updated "title" changes the graph if there is an "updatedBy"', () => {
          const update = NodeUpdate.createFromPartial(
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
            {
              title: "My updated article's title",
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            updatedBy: {
              username: 'yvann',
            },
          });
        });
      });

      describe('ArticleExtension', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromPartial(
            ArticleExtension,
            {},
            {
              article: { _id: 4 },
              source: null,
            },
          );

          const dependentGraph = dependency.createDependentGraph(creation);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            _id: 4,
          });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromPartial(
            ArticleExtension,
            {},
            {
              article: { _id: 5 },
              source: null,
            },
          );

          const dependentGraph = dependency.createDependentGraph(deletion);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            _id: 5,
          });
        });

        it('The updated "source" does not change any document', () => {
          const update = NodeUpdate.createFromPartial(
            ArticleExtension,
            {},
            {
              article: { _id: 6 },
              source: null,
            },
            {
              source: 'A source',
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });
      });

      describe('UserProfile', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromPartial(
            UserProfile,
            {},
            {
              user: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' },
              facebookId: 'my-facebook-id',
            },
          );

          const dependentGraph = dependency.createDependentGraph(creation);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            createdBy: {
              id: '16050880-dabc-4348-bd3b-d41efe1b6057',
            },
          });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromPartial(
            UserProfile,
            {},
            {
              user: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' },
              facebookId: 'my-facebook-id',
            },
          );

          const dependentGraph = dependency.createDependentGraph(deletion);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            createdBy: {
              id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485',
            },
          });
        });

        it('The updated "birthday" does not change any document', () => {
          const update = NodeUpdate.createFromPartial(
            UserProfile,
            {},
            {
              user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
            },
            {
              birthday: '1987-04-28',
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(dependentGraph.isEmpty());
        });

        it('The updated "facebookId" may change some document(s)', () => {
          const update = NodeUpdate.createFromPartial(
            UserProfile,
            {},
            {
              user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
              facebookId: 'my-facebook-id',
            },
            {
              facebookId: 'another-facebook-id',
            },
          );

          const dependentGraph = dependency.createDependentGraph(update);

          assert(!dependentGraph.isEmpty());
          assert.deepEqual(dependentGraph.target.inputValue, {
            createdBy: {
              id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215',
            },
          });
        });
      });
    });
  });
});
