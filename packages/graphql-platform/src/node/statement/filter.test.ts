import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { ArticleStatus, createMyGP } from '../../__tests__/config.js';
import type { UniqueConstraint } from '../../node.js';
import type { FlattenedNodeDependencyTreeJSON } from '../dependency.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';

describe('Filter', () => {
  const gp = createMyGP();

  const Article = gp.getNodeByName('Article');
  const ArticleExtension = gp.getNodeByName('ArticleExtension');
  const UserProfile = gp.getNodeByName('UserProfile');

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
      it(`${index} - ${nodeName}.filter(${inspect(filter, undefined, 5)}).isExecutableWithin(${uniqueName})`, () => {
        const node = gp.getNodeByName(nodeName);
        const unique = node.getUniqueConstraintByName(uniqueName);

        assert.strictEqual(
          node.filterInputType
            .parseAndFilter(filter)
            .isExecutableWithin(unique.selection),
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
        [
          'Article',
          {
            OR: [
              { tags_some: { tag: { slug: 'tv' } } },
              { tags_some: { tag: { slug: 'news' } } },
            ],
          },
          '{tags_some: {tag: {slug_in: ["tv", "news"]}}}',
        ],
        [
          'Article',
          {
            AND: [
              { tags_some: { tag: { slug: 'tv' } } },
              { tags_some: { tag: { slug: 'news' } } },
            ],
          },
          '{tags_some: {tag: {slug: "tv"}}, AND: [{tags_some: {tag: {slug: "news"}}}]}',
        ],
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
        ['Article', { _id_gt: 4, _id_lt: 8 }, {}],
        [
          'Article',
          { category: {} },
          {
            Article: {
              update: ['category'],
            },
          },
        ],
        [
          'Article',
          { tags_some: { tag: { deprecated_not: true } } },
          {
            ArticleTag: {
              creation: true,
              deletion: true,
            },
            Tag: {
              update: ['deprecated'],
            },
          },
        ],
      ] satisfies [
        nodeName: string,
        input: NodeFilterInputValue,
        expected: FlattenedNodeDependencyTreeJSON,
      ][]
    ).forEach(([nodeName, input, expected], index) => {
      it(`${index} - ${nodeName}.dependency`, () => {
        const node = gp.getNodeByName(nodeName);
        const filter = node.filterInputType.parseAndFilter(input);

        assert.deepEqual(filter.dependencyTree.flattened.toJSON(), expected);
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
  });
});
