import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import type { Node } from '../../node.js';
import { NodeCreation, NodeDeletion, NodeUpdate } from '../change.js';
import type { NodeOrdering } from './ordering.js';

describe('Ordering', () => {
  let gp: MyGP;

  let Article: Node;
  let ArticleTag: Node;

  beforeAll(() => {
    gp = createMyGP();

    Article = gp.getNodeByName('Article');
    ArticleTag = gp.getNodeByName('ArticleTag');
  });

  describe('Execution', () => {
    describe("Node-changes' effect", () => {
      let ordering: NodeOrdering;

      beforeAll(() => {
        ordering = Article.orderingInputType.sort([
          'createdAt_DESC',
          'tagCount_DESC',
        ]);
      });

      describe('Article', () => {
        it('The updated "slug" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
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

          expect(ordering.isAffectedByNodeUpdate(update)).toBe(false);
          expect(ordering.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });
      });

      describe('ArticleTag', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromNonNullableComponents(
            ArticleTag,
            {},
            {
              article: { _id: 2 },
              tag: { id: '4f2b2a03-7d62-4474-a497-d274639e90f3' },
              order: 2,
            },
          );

          expect(
            ordering.getAffectedGraphByNodeChange(creation).inputValue,
          ).toEqual({ _id: 2 });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromNonNullableComponents(
            ArticleTag,
            {},
            {
              article: { _id: 3 },
              tag: { id: '99ece8fe-68d8-4223-bd91-c0471b378984' },
              order: 3,
            },
          );

          expect(
            ordering.getAffectedGraphByNodeChange(deletion).inputValue,
          ).toEqual({ _id: 3 });
        });

        it('The updated "order" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              tag: { id: '3152ee02-2e8e-4734-9b30-5f92e2673839' },
              order: 4,
            },
            {
              order: 5,
            },
          );

          expect(ordering.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });
      });
    });
  });
});
