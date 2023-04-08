import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import { toTestableDependencies } from '../result-set.js';
import type { RawNodeSelection } from '../type/output/node.js';

describe('Selection', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP();
  });

  it.each<
    [
      nodeName: string,
      selection: RawNodeSelection,
      expected: Record<string, any>,
    ]
  >([
    [
      'Article',
      `{
        id
        title
      }`,
      { id: true, title: true },
    ],
    [
      'Article',
      `{
        id
        title
        tags (first: 10) {
          order
          tag {
            title
          }
        }
      }`,
      {
        id: true,
        title: true,
        tags: { article: true, order: true, tag: { title: true } },
      },
    ],
    [
      'Article',
      `{
        id
        title
        tagCount
      }`,
      { id: true, title: true, tags: { article: true } },
    ],
    [
      'Article',
      `{
        title
        tags (where: { tag: { title: "My tag" }}, first: 10) {
          order
        }
      }`,
      {
        title: true,
        tags: {
          article: true,
          order: true,
          tag: { title: true },
        },
      },
    ],
    [
      'Article',
      `{
        title
        tags (orderBy: [order_ASC], first: 10) {
          tag {
            title
          }
        }
      }`,
      {
        title: true,
        tags: {
          article: true,
          order: true,
          tag: { title: true },
        },
      },
    ],
  ])('%# - is aware of its dependencies', (nodeName, selection, expected) =>
    expect(
      toTestableDependencies(
        gp.getNodeByName(nodeName).outputType.select(selection).dependencies,
      ),
    ).toEqual(expected),
  );
});
