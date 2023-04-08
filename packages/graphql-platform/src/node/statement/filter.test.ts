import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import { toTestableDependencies } from '../result-set.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';

describe('Filter', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP();
  });

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
  ])('%# - is aware of its dependencies', (nodeName, filter, expected) =>
    expect(
      toTestableDependencies(
        gp.getNodeByName(nodeName).filterInputType.parseAndFilter(filter)
          .dependencies,
      ),
    ).toEqual(expected),
  );
});
