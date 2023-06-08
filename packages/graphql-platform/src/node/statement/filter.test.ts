import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import { toTestableDependencies } from '../result-set.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';

describe('Filter', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP();
  });

  describe('Dependencies', () => {
    it.each<
      [
        nodeName: string,
        filter: NodeFilterInputValue,
        expected: Record<string, any>,
      ]
    >([
      ['ArticleTag', { order_gt: 5 }, { order: true }],
      [
        'ArticleTag',
        {
          article: { title: 'My article title', tagCount_gt: 0 },
          tag: { title: 'My tag title' },
        },
        {
          article: { title: true, tags: { article: true } },
          tag: { title: true },
        },
      ],
      [
        'Article',
        {
          tagCount_gt: 5,
          tags_some: { tag: { title: 'my title' } },
        },
        { tags: { article: true, tag: { title: true } } },
      ],
    ])('%# - %s.filter(%p).dependencies = %p', (nodeName, filter, expected) =>
      expect(
        toTestableDependencies(
          gp.getNodeByName(nodeName).filterInputType.parseAndFilter(filter)
            .dependencies,
        ),
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
      // ['Article', { title_contains: 'News' }, { title: 'The news' }, true],

      ['Article', { title_starts_with: 'Thes' }, { title: 'The news' }, false],
      ['Article', { title_starts_with: 'The' }, { title: 'The news' }, true],
      // ['Article', { title_starts_with: 'the' }, { title: 'The news' }, true],

      ['Article', { title_ends_with: 'newss' }, { title: 'The news' }, false],
      ['Article', { title_ends_with: 'news' }, { title: 'The news' }, true],
      // ['Article', { title_ends_with: 'News' }, { title: 'The news' }, true],
      [
        'Article',
        { AND: [{ title_starts_with: 'The' }, { title_ends_with: 'news' }] },
        { title: 'The news' },
        true,
      ],
    ])(
      '%# - %s.filter(%p).execute(%p) = %p',
      (nodeValue, filter, value, expected) =>
        expect(
          gp
            .getNodeByName(nodeValue)
            .filterInputType.parseAndFilter(filter)
            .execute(value),
        ).toEqual(expected),
    );
  });
});
