import { describe, expect, it } from '@jest/globals';
import { GraphQLPlatform } from '../../index.js';
import {
  NodeChange,
  NodeChangeAggregation,
  NodeCreation,
  createNodeUpdateFromComponentUpdates,
} from '../change.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';
import type { OrderByInputValue } from '../type/input/ordering.js';
import type { NodeUniqueFilterInputValue } from '../type/input/unique-filter.js';
import type { RawNodeSelection } from '../type/output/node.js';
import {
  ResultSetMutability,
  toTestableDependencies,
  toTestableFlatDependencies,
} from './mutability.js';

describe('Mutability', () => {
  type MyTestRequestContext = {};
  let myContext = {} satisfies MyTestRequestContext;

  const gp: GraphQLPlatform<MyTestRequestContext> = new GraphQLPlatform({
    nodes: {
      Article: {
        components: {
          id: {
            type: 'UUIDv4',
            nullable: false,
            mutable: false,
          },
          status: {
            type: 'String',
            nullable: false,
          },
          slug: {
            type: 'String',
          },
          title: {
            type: 'String',
          },
          category: {
            kind: 'Edge',
            head: 'Category',
          },
        },
        uniques: [['id']],
        reverseEdges: {
          tags: { originalEdge: 'ArticleTag.article' },
          logs: { originalEdge: 'ArticleLog.article' },
        },
      },
      Category: {
        components: {
          id: {
            type: 'UnsignedInt',
            nullable: false,
            mutable: false,
          },
          title: {
            type: 'String',
          },
          parent: {
            kind: 'Edge',
            head: 'Category',
          },
        },
        uniques: [['id']],
        reverseEdges: {
          children: { originalEdge: 'Category.parent' },
          articles: { originalEdge: 'Article.category' },
        },
      },
      Tag: {
        components: {
          id: {
            type: 'UnsignedInt',
            nullable: false,
            mutable: false,
          },
          title: {
            type: 'String',
          },
        },
        uniques: [['id']],
        reverseEdges: { articles: { originalEdge: 'ArticleTag.tag' } },
      },
      ArticleTag: {
        components: {
          article: {
            kind: 'Edge',
            head: 'Article',
            nullable: false,
            mutable: false,
          },
          tag: {
            kind: 'Edge',
            head: 'Tag',
            nullable: false,
            mutable: false,
          },
          order: {
            type: 'UnsignedInt',
            nullable: false,
          },
        },
        uniques: [['article', 'tag']],
      },
      ArticleLog: {
        components: {
          article: {
            kind: 'Edge',
            head: 'Article',
            nullable: false,
            mutable: false,
          },
          order: {
            type: 'UnsignedInt',
            nullable: false,
            mutable: false,
          },
          text: {
            type: 'String',
            nullable: false,
          },
        },
        uniques: [['article', 'order']],
      },
    },
  });

  describe.each<
    [
      nodeName: string,
      filter: NodeFilterInputValue,
      orderBy: OrderByInputValue,
      selection: RawNodeSelection,
      expectedDependencies: Record<string, any>,
      expectedFlatDirectDependencies: Record<string, string[]>,
      expectedFlatDependencies: Record<string, string[]>,
      scenarios: ReadonlyArray<
        {
          label: string;
          changes: ReadonlyArray<NodeChange>;
        } & (
          | ({
              expectedDirectlyRelevantAggregation: false;
              expectedRelevantChanges?: undefined;
              expectedRelevantReferences?: undefined;
            } & (
              | {
                  expectedRelevantAggregation: false;
                  expectedRelevantFilters?: undefined;
                }
              | {
                  expectedRelevantAggregation: true;
                  expectedRelevantFilters?: NonNullable<NodeFilterInputValue>[];
                }
            ))
          | {
              expectedDirectlyRelevantAggregation: true;
              expectedRelevantChanges?: NonNullable<NodeUniqueFilterInputValue>[];
              expectedRelevantReferences?: NonNullable<NodeUniqueFilterInputValue>[];
              expectedRelevantAggregation: true;
              expectedRelevantFilters?: NonNullable<NodeFilterInputValue>[];
            }
        )
      >,
    ]
  >([
    [
      'Article',
      undefined,
      undefined,
      `{
        id
        title
      }`,
      { id: true, title: true },
      { Article: ['id', 'title'] },
      { Article: ['id', 'title'] },
      [
        {
          label: 'These changes are not relevant',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Category'),
              myContext,
              {
                id: 1,
                title: "My first category's title",
                parent: null,
              },
              {
                title: "My first category's updated title",
              },
            ),
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
              order: 1,
              tag: { id: 2 },
            }),
          ],
          expectedDirectlyRelevantAggregation: false,
          expectedRelevantAggregation: false,
        },
        {
          label: 'These changes are relevant',
          changes: [
            new NodeCreation(gp.getNodeByName('Article'), myContext, {
              id: 'e87bbe5b-5be8-462a-bcf4-eb68c89fe439',
              status: 'PUBLISHED',
              slug: 'my-slug',
              title: "My second article's title",
              category: { id: 1 },
            }),
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Article'),
              myContext,
              {
                id: '193278b3-61b2-4d95-a671-6d324e10d9b1',
                status: 'DRAFT',
                slug: 'my-slug',
                title: "My third article's title",
                category: { id: 1 },
              },
              {
                title: "My third article's updated title",
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantAggregation: true,
          expectedRelevantChanges: [
            { id: 'e87bbe5b-5be8-462a-bcf4-eb68c89fe439' },
            { id: '193278b3-61b2-4d95-a671-6d324e10d9b1' },
          ],
        },
      ],
    ],
    [
      'Article',
      { status: 'PUBLISHED' },
      undefined,
      `{
        id
        title
      }`,
      { status: true, id: true, title: true },
      { Article: ['status', 'id', 'title'] },
      { Article: ['status', 'id', 'title'] },
      [
        {
          label: 'These changes are not relevant',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Category'),
              myContext,
              {
                id: 1,
                title: "My first category's title",
                parent: null,
              },
              {
                title: "My first category's updated title",
              },
            ),
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
              order: 1,
              tag: { id: 2 },
            }),
          ],
          expectedDirectlyRelevantAggregation: false,
          expectedRelevantAggregation: false,
        },
        {
          label: 'These changes looks relevant but are not',
          changes: [
            new NodeCreation(gp.getNodeByName('Article'), myContext, {
              id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb',
              status: 'DRAFT',
              slug: 'my-slug',
              title: "My first article's title",
              category: { id: 1 },
            }),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantAggregation: true,
        },
        {
          label: 'These changes are relevant',
          changes: [
            new NodeCreation(gp.getNodeByName('Article'), myContext, {
              id: 'e87bbe5b-5be8-462a-bcf4-eb68c89fe439',
              status: 'PUBLISHED',
              slug: 'my-slug',
              title: "My second article's title",
              category: { id: 1 },
            }),
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Article'),
              myContext,
              {
                id: 'bd7d8c48-678f-44b9-814e-8b904895495e',
                status: 'DRAFT',
                slug: 'my-slug',
                title: "My third article's title",
                category: { id: 1 },
              },
              {
                status: 'PUBLISHED',
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantAggregation: true,
          expectedRelevantChanges: [
            { id: 'e87bbe5b-5be8-462a-bcf4-eb68c89fe439' },
            { id: 'bd7d8c48-678f-44b9-814e-8b904895495e' },
          ],
        },
      ],
    ],
    [
      'Article',
      {
        status: 'PUBLISHED',
        category_is_null: false,
        OR: [
          { logCount_gt: 0 },
          { tags_some: { tag: { title: 'My required title' } } },
        ],
      },
      ['tagCount_DESC'],
      `{
        title
        category {
          id
        }
        tags(orderBy: [order_ASC], first: 10) {
          tag {
            title
          }
        }
      }`,
      {
        category: { id: true },
        logs: { article: true },
        status: true,
        tags: { article: true, order: true, tag: { title: true } },
        title: true,
      },
      {
        Article: ['status', 'category', 'title'],
        ArticleLog: ['article'],
        ArticleTag: ['article', 'tag', 'order'],
      },
      {
        Article: ['status', 'category', 'title'],
        ArticleLog: ['article'],
        Category: ['id'],
        ArticleTag: ['article', 'tag', 'order'],
        Tag: ['title'],
      },
      [
        {
          label: 'These changes are not relevant',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('ArticleLog'),
              myContext,
              {
                article: { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
                order: 1,
                text: "My first log's text",
              },
              {
                text: "My first log's updated text",
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: false,
          expectedRelevantAggregation: false,
        },
        {
          label: 'These changes looks relevant but are not',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Category'),
              myContext,
              {
                id: 1,
                title: "My first category's title",
                parent: null,
              },
              {
                title: "My first category's updated title",
              },
            ),
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
              order: 1,
              tag: { id: 2 },
            }),
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
              order: 2,
              tag: { id: 1 },
            }),
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'a6b13907-6492-4fe4-bc19-95efae2413b9' },
              order: 1,
              tag: { id: 1 },
            }),
            // This article reference won't be in the relevant references because it refers to the change below, DRAFT, not relevant
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'b936b428-a955-41e9-9837-af7c15a9ec8c' },
              order: 1,
              tag: { id: 1 },
            }),
            new NodeCreation(gp.getNodeByName('Article'), myContext, {
              id: 'b936b428-a955-41e9-9837-af7c15a9ec8c',
              status: 'DRAFT',
              slug: 'my-slug',
              title: "My article's title",
              category: { id: 1 },
            }),
            new NodeCreation(gp.getNodeByName('Article'), myContext, {
              id: '326781f3-c276-4f6b-a65e-960bd67f480e',
              status: 'PUBLISHED',
              slug: 'my-slug',
              title: "My article's title",
              category: null,
            }),
            // This article reference will let the change below to be relevant
            new NodeCreation(gp.getNodeByName('ArticleTag'), myContext, {
              article: { id: 'bd839a4c-b270-46ad-bb35-54008c598219' },
              order: 1,
              tag: { id: 1 },
            }),
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Article'),
              myContext,
              {
                id: 'bd839a4c-b270-46ad-bb35-54008c598219',
                status: 'PUBLISHED',
                slug: 'my-slug',
                title: "My article's title",
                category: { id: 1 },
              },
              {
                slug: 'my-new-slug',
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantChanges: [
            { id: 'bd839a4c-b270-46ad-bb35-54008c598219' },
          ],
          expectedRelevantReferences: [
            { id: 'fedac9b6-999c-496a-a2c7-463b2fb80fdb' },
            { id: 'a6b13907-6492-4fe4-bc19-95efae2413b9' },
          ],
          expectedRelevantAggregation: true,
        },
        {
          label: 'These changes are relevant',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Article'),
              myContext,
              {
                id: 'e35d06e1-39bd-4053-888f-a747b63268e8',
                status: 'PUBLISHED',
                slug: 'my-slug',
                title: "My article's title",
                category: { id: 1 },
              },
              {
                title: "My updated article's title",
              },
            ),
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Article'),
              myContext,
              {
                id: '8d7a251a-5dba-4bdb-96d5-8e13651da679',
                status: 'PUBLISHED',
                slug: 'my-slug',
                title: "My article's title",
                category: null,
              },
              {
                category: { id: 1 },
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantChanges: [
            { id: 'e35d06e1-39bd-4053-888f-a747b63268e8' },
            { id: '8d7a251a-5dba-4bdb-96d5-8e13651da679' },
          ],
          expectedRelevantAggregation: true,
        },
      ],
    ],
    [
      'Article',
      { status: 'PUBLISHED' },
      undefined,
      `{
        title
        tags(orderBy: [order_ASC], first: 10) {
          tag {
            title
          }
        }
      }`,
      {
        status: true,
        title: true,
        tags: { article: true, order: true, tag: { title: true } },
      },
      {
        Article: ['status', 'title'],
        ArticleTag: ['article', 'order', 'tag'],
      },
      {
        Article: ['status', 'title'],
        ArticleTag: ['article', 'order', 'tag'],
        Tag: ['title'],
      },
      [
        {
          label: 'This change is not directly relevant but is indirectly',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Tag'),
              myContext,
              {
                id: 5,
                title: 'My old title',
              },
              {
                title: 'My new title',
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: false,
          expectedRelevantAggregation: true,
        },
      ],
    ],
    [
      'Category',
      undefined,
      undefined,
      `{
        title
        children(first: 10) {
          title
          children(first: 10) {
            title
          }
        }
      }`,
      {
        title: true,
        children: {
          parent: true,
          title: true,
          children: {
            parent: true,
            title: true,
          },
        },
      },
      {
        Category: ['title', 'parent'],
      },
      {
        Category: ['title', 'parent'],
      },
      [
        {
          label: 'This change is directly relevant',
          changes: [
            createNodeUpdateFromComponentUpdates(
              gp.getNodeByName('Category'),
              myContext,
              {
                id: 10,
                title: 'My old title',
                parent: null,
              },
              {
                title: 'My new title',
              },
            ),
          ],
          expectedDirectlyRelevantAggregation: true,
          expectedRelevantChanges: [{ id: 10 }],
          expectedRelevantAggregation: true,
        },
      ],
    ],
  ])(
    'Definition %#',
    (
      nodeName,
      filter,
      orderBy,
      selection,
      expectedDependencies,
      expectedFlatDirectDependencies,
      expectedFlatDependencies,
      scenarios,
    ) => {
      const mutability = new ResultSetMutability(gp.getNodeByName(nodeName), {
        filter: gp
          .getNodeByName(nodeName)
          .filterInputType.parseAndFilter(filter),
        ordering: gp.getNodeByName(nodeName).orderingInputType.sort(orderBy),
        selection: gp.getNodeByName(nodeName).outputType.select(selection),
      });

      it('has expected dependencies', () => {
        expect(toTestableDependencies(mutability.dependencies)).toEqual(
          expectedDependencies,
        );
      });

      it('has expected flat direct dependencies', () => {
        expect(
          toTestableFlatDependencies(mutability.flatDirectDependencies),
        ).toEqual(expectedFlatDirectDependencies);
      });

      it('has expected flat dependencies', () => {
        expect(toTestableFlatDependencies(mutability.flatDependencies)).toEqual(
          expectedFlatDependencies,
        );
      });

      if (scenarios.length) {
        describe.each(scenarios)(
          'Scenario $# - $label',
          ({
            changes,
            expectedDirectlyRelevantAggregation,
            expectedRelevantChanges,
            expectedRelevantReferences,
            expectedRelevantAggregation,
            expectedRelevantFilters,
          }) => {
            const aggregation = new NodeChangeAggregation(changes);

            it(`.isChangeAggregationDirectlyRelevant() = ${expectedDirectlyRelevantAggregation}`, () => {
              expect(mutability.areChangesDirectlyRelevant(aggregation)).toBe(
                expectedDirectlyRelevantAggregation,
              );
            });

            it(`.pickRelevantChanges() = ${JSON.stringify(
              expectedRelevantChanges,
            )}`, () => {
              expect(
                mutability
                  .pickRelevantChanges(aggregation)
                  ?.map((change) => change.id),
              ).toEqual(expectedRelevantChanges);
            });

            it(`.pickRelevantReferences() = ${JSON.stringify(
              expectedRelevantReferences,
            )}`, () => {
              expect(mutability.pickRelevantReferences(aggregation)).toEqual(
                expectedRelevantReferences,
              );
            });

            it(`.isChangeAggregationRelevant() = ${expectedRelevantAggregation}`, () => {
              expect(mutability.areChangesRelevant(aggregation)).toBe(
                expectedRelevantAggregation,
              );
            });

            it(`.pickRelevantFilters() = ${JSON.stringify(
              expectedRelevantFilters,
            )}`, () => {
              expect(mutability.pickRelevantFilters(aggregation)).toEqual(
                expectedRelevantFilters,
              );
            });
          },
        );
      }
    },
  );
});
