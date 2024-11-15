import { beforeAll, describe, expect, it } from '@jest/globals';
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

  beforeAll(() => {
    gp = createMyGP();

    Article = gp.getNodeByName('Article');
    ArticleExtension = gp.getNodeByName('ArticleExtension');
    UserProfile = gp.getNodeByName('UserProfile');
  });

  describe('Definition', () => {
    it.each<
      [
        nodeName: string,
        filter: NodeFilterInputValue,
        uniqueName: UniqueConstraint['name'],
        expected: boolean,
      ]
    >([
      ['Article', { title_contains: 'newss' }, '_id', false],
      ['Article', { _id: 5 }, '_id', true],
      ['Article', { OR: [{ _id: 5 }, { _id_gt: 6 }] }, '_id', true],
    ])(
      '%# - %s.filter(%o).isExecutableWithinUniqueConstraint(%p) = %p',
      (nodeName, filter, uniqueName, expected) => {
        const node = gp.getNodeByName(nodeName);
        const unique = node.getUniqueConstraintByName(uniqueName);

        expect(
          node.filterInputType
            .parseAndFilter(filter)
            .isExecutableWithinUniqueConstraint(unique),
        ).toEqual(expected);
      },
    );

    it.each<[nodeName: string, input: NodeFilterInputValue, expected: string]>([
      ['Article', undefined, '{}'],
      ['Article', null, 'null'],
      ['Article', { _id_gt: 4, _id_lt: 8 }, '{_id_gt: 4, _id_lt: 8}'],
      ['Article', { status: ArticleStatus.PUBLISHED }, '{status: PUBLISHED}'],
      ['Article', { views_gt: BigInt(123456) }, '{views_gt: "123456"}'],
      ['Article', { score_gte: 0.5 }, '{score_gte: 0.5}'],
      ['Article', { category: {} }, '{category: {}}'],
    ])('%# - %s.filter(%o) = %p', (nodeName, input, expected) => {
      const node = gp.getNodeByName(nodeName);
      const filterInputType = node.filterInputType;
      const filter = filterInputType.parseAndFilter(input);

      expect(String(filter)).toEqual(expected);
    });

    it.each<
      [
        nodeName: string,
        input: NodeFilterInputValue,
        expected: DependencySummaryJSON,
      ]
    >([
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
    ])('%p.dependency = %p', (nodeName, input, expected) =>
      expect(
        gp
          .getNodeByName(nodeName)
          .filterInputType.parseAndFilter(input)
          .dependencyGraph.summary.toJSON(),
      ).toEqual(expected),
    );
  });

  describe('Execution', () => {
    it.each<
      [
        nodeName: string,
        filter: NodeFilterInputValue,
        value: any,
        expected: boolean | undefined,
      ]
    >([
      ['ArticleTag', { order_gt: 2 }, {}, undefined],
      ['ArticleTag', { order_gt: 2 }, { order: 2 }, false],
      ['ArticleTag', { order_gte: 2 }, { order: 2 }, true],

      ['Article', { title_contains: 'newss' }, { title: 'The news' }, false],
      ['Article', { title_contains: 'news' }, { title: 'The news' }, true],

      ['Article', { title_starts_with: 'Thes' }, { title: 'The news' }, false],
      ['Article', { title_starts_with: 'The' }, { title: 'The news' }, true],

      ['Article', { title_ends_with: 'newss' }, { title: 'The news' }, false],
      ['Article', { title_ends_with: 'news' }, { title: 'The news' }, true],
      [
        'Article',
        { AND: [{ title_starts_with: 'The' }, { title_ends_with: 'news' }] },
        { title: 'The news' },
        true,
      ],
    ])(
      '%# - %s.filter(%p).execute(%p, true) = %p',
      (nodeName, filter, value, expected) =>
        expect(
          gp
            .getNodeByName(nodeName)
            .filterInputType.parseAndFilter(filter)
            .execute(value, true),
        ).toEqual(expected),
    );

    describe("Node-changes' effect", () => {
      let filter: NodeFilter;
      let dependency: NodeDependencyGraph;

      beforeAll(() => {
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

          expect(dependentGraph.isEmpty()).toBeTruthy();
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

            expect(dependentGraph.isEmpty()).toBeTruthy();
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

            expect(dependentGraph.isEmpty()).toBeFalsy();
            expect(dependentGraph.changes.size).toBe(1);
            expect(dependentGraph.target.isFalse()).toBeTruthy();
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

          expect(dependentGraph.isEmpty()).toBeTruthy();
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "createdBy": {
               "id": "9121c47b-87b6-4334-ae1d-4c9777e87576",
             },
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeTruthy();
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "updatedBy": {
               "username": "yvann",
             },
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "_id": 4,
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "_id": 5,
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeTruthy();
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "createdBy": {
               "id": "16050880-dabc-4348-bd3b-d41efe1b6057",
             },
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "createdBy": {
               "id": "7caf940a-058a-4ef2-a8bf-ac2d6cae3485",
             },
           }
          `);
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

          expect(dependentGraph.isEmpty()).toBeTruthy();
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.target.inputValue).toMatchInlineSnapshot(`
           {
             "createdBy": {
               "id": "8e3587e8-2e4e-46a4-a6e0-27f08aebb215",
             },
           }
          `);
        });
      });
    });
  });
});
