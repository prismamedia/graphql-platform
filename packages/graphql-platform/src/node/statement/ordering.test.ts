import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import { toTestableDependencies } from '../result-set.js';
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
    ['ArticleTag', ['order_ASC'], { order: true }],
    ['Article', ['tagCount_DESC'], { tags: { article: true } }],
  ])('%# - is aware of its dependencies', (nodeName, orderBy, expected) =>
    expect(
      toTestableDependencies(
        gp.getNodeByName(nodeName).orderingInputType.sort(orderBy).dependencies,
      ),
    ).toEqual(expected),
  );
});
