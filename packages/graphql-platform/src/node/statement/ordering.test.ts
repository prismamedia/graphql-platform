import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import type { OrderByInputValue } from '../type/input/ordering.js';

describe('Ordering', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP();
  });

  it.each<
    [
      nodeName: string,
      orderBy: OrderByInputValue,
      expected: Record<string, any>,
    ]
  >([
    ['ArticleTag', ['order_ASC'], { order: undefined }],
    ['Article', ['tagCount_DESC'], { tags: { article: undefined } }],
  ])('%# - %s.sort(%p).dependencies = %p', (nodeName, orderBy, expected) =>
    expect(
      gp
        .getNodeByName(nodeName)
        .orderingInputType.sort(orderBy)
        .dependencies?.debug(),
    ).toEqual(expected),
  );
});
