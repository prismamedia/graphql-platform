import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
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
      ['ArticleTag', { order_gt: 5 }, { order: undefined }],
      [
        'ArticleTag',
        {
          article: { title: 'My article title', tagCount_gt: 0 },
          tag: { title: 'My tag title' },
        },
        {
          article: { title: undefined, tags: { article: undefined } },
          tag: { title: undefined },
        },
      ],
      [
        'Article',
        {
          tagCount_gt: 5,
          tags_some: { tag: { title: 'my title' } },
        },
        { tags: { article: undefined, tag: { title: undefined } } },
      ],
    ])('%# - %s.filter(%p).dependencies = %p', (nodeName, filter, expected) =>
      expect(
        gp
          .getNodeByName(nodeName)
          .filterInputType.parseAndFilter(filter)
          .dependencies?.debug(),
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
  });
});
