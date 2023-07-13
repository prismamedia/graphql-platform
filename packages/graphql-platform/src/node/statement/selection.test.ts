import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
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
      { id: undefined, title: undefined },
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
        id: undefined,
        title: undefined,
        tags: {
          article: undefined,
          order: undefined,
          tag: { title: undefined },
        },
      },
    ],
    [
      'Article',
      `{
        id
        title
        tagCount
      }`,
      { id: undefined, title: undefined, tags: { article: undefined } },
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
        title: undefined,
        tags: {
          article: undefined,
          order: undefined,
          tag: { title: undefined },
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
        title: undefined,
        tags: {
          article: undefined,
          order: undefined,
          tag: { title: undefined },
        },
      },
    ],
  ])('%# - %s.select(%p).dependencies = $p', (nodeName, selection, expected) =>
    expect(
      gp
        .getNodeByName(nodeName)
        .outputType.select(selection)
        .dependencies?.debug(),
    ).toEqual(expected),
  );
});
