import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  createMyGP,
  myAdminContext,
  type MyGP,
} from '../../__tests__/config.js';
import type { Node } from '../../node.js';
import { NodeCreation, NodeDeletion, NodeUpdate } from '../change.js';
import { OperationContext } from '../operation.js';
import { NodeSelection } from './selection.js';

describe('Selection', () => {
  let gp: MyGP;

  let Article: Node;
  let ArticleExtension: Node;
  let ArticleTag: Node;
  let Category: Node;
  let Tag: Node;
  let User: Node;
  let UserProfile: Node;

  beforeAll(() => {
    gp = createMyGP();

    Article = gp.getNodeByName('Article');
    ArticleExtension = gp.getNodeByName('ArticleExtension');
    ArticleTag = gp.getNodeByName('ArticleTag');
    Category = gp.getNodeByName('Category');
    Tag = gp.getNodeByName('Tag');
    User = gp.getNodeByName('User');
    UserProfile = gp.getNodeByName('UserProfile');
  });

  describe('Execution', () => {
    it.each([
      [
        {
          id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
          status: ArticleStatus.DRAFT,
          lowerCasedTitle: {
            status: ArticleStatus.DRAFT,
            title: 'My title',
            category: null,
          },
        },
        {
          id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
          status: ArticleStatus.DRAFT,
          lowerCasedTitle: 'draft-my title',
        },
      ],
      [
        {
          id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
          status: ArticleStatus.DRAFT,
          lowerCasedTitle: {
            status: ArticleStatus.DRAFT,
            title: 'My title',
            category: { title: 'My category' },
          },
        },
        {
          id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
          status: ArticleStatus.DRAFT,
          lowerCasedTitle: 'draft-my title-my category',
        },
      ],
    ])('Parses & resolves', async (source, value) => {
      const selection = Article.outputType.select(`{
        id
        status
        lowerCasedTitle
      }`);

      expect(selection.parseSource(source)).toEqual(source);

      await expect(
        selection.resolveValue(
          source,
          new OperationContext(gp, myAdminContext),
        ),
      ).resolves.toEqual(value);
    });

    describe("Node-changes' effect", () => {
      let selection: NodeSelection;

      beforeAll(() => {
        selection = Article.outputType.select(`{
          id
          title
          extension {
            source
          }
          category {
            parent {
              title
            }
          }
          createdBy {
            username
            profile {
              facebookId
            }
            createdArticles(orderBy: [createdAt_DESC], first: 5) {
              title
            }
          }
          updatedBy {
            username
            profile {
              facebookId
            }
            updatedArticles(orderBy: [updatedAt_DESC], first: 5) {
              title
            }
          }
          tagCount(where: { order_gt: 0, tag: { deprecated_not: true }})
        }`);
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

          expect(selection.isAffectedByNodeUpdate(update)).toBe(false);
          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });

        it('The updated "title" does not change any document if there is no "createdBy" or "updatedBy"', () => {
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
              title: 'My new test article',
            },
          );

          expect(selection.isAffectedByNodeUpdate(update)).toBe(true);
          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });

        it('The updated "title" may change some document(s) if there is a "createdBy" or an "updatedBy"', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            Article,
            {},
            {
              _id: 5,
              id: 'aeb49c83-ee71-4662-bf5e-4ea53a6ae150',
              status: ArticleStatus.DRAFT,
              title: 'My test article',
              slug: 'my-test-article',
              createdBy: { id: '9121c47b-87b6-4334-ae1d-4c9777e87576' },
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedBy: { username: 'yvann' },
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
              views: 0,
              score: 0,
            },
            {
              title: 'My new test article',
            },
          );

          expect(selection.isAffectedByNodeUpdate(update)).toBe(true);
          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({
            OR: [
              { createdBy: { id: '9121c47b-87b6-4334-ae1d-4c9777e87576' } },
              { updatedBy: { username: 'yvann' } },
            ],
          });
        });

        it('The updated "updatedAt" may change some document(s) if there is an "updatedBy"', () => {
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
              updatedBy: { username: 'yvann' },
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
              views: 0,
              score: 0,
            },
            {
              updatedAt: new Date('2021-06-01T00:00:00.000Z'),
            },
          );

          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({ updatedBy: { username: 'yvann' } });
        });
      });

      describe('Category', () => {
        it('The updated "order" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            Category,
            {},
            {
              _id: 10,
              id: 'b779d46f-b364-455a-83a8-4284077a9b18',
              order: 0,
              title: 'My test category',
              slug: 'my-test-category',
            },
            {
              order: 1,
            },
          );

          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });

        it('The updated "parent" may change some document(s)', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            Category,
            {},
            {
              _id: 10,
              id: 'b779d46f-b364-455a-83a8-4284077a9b18',
              order: 0,
              title: 'My test category',
              slug: 'my-test-category',
            },
            {
              parent: { _id: 20 },
            },
          );

          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({
            category: { _id: 10 },
          });
        });
      });

      describe('User', () => {
        it('The updated "lastLoggedInAt" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            User,
            {},
            {
              id: '42d6a939-31d7-47f4-b186-32c838d11f40',
              username: 'yvann',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            {
              lastLoggedInAt: new Date(),
            },
          );

          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });
      });

      describe('UserProfile', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromNonNullableComponents(
            UserProfile,
            {},
            { user: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
          );

          expect(
            selection.getAffectedGraphByNodeChange(creation)?.inputValue,
          ).toEqual({
            OR: [
              { createdBy: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
              { updatedBy: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' } },
            ],
          });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromNonNullableComponents(
            UserProfile,
            {},
            { user: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
          );

          expect(
            selection.getAffectedGraphByNodeChange(deletion)?.inputValue,
          ).toEqual({
            OR: [
              { createdBy: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
              { updatedBy: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' } },
            ],
          });
        });

        it('The updated "birthday" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            UserProfile,
            {},
            {
              user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
            },
            {
              birthday: '1987-04-28',
            },
          );

          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });

        it('The updated "facebookId" may change some document(s)', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            UserProfile,
            {},
            {
              user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
            },
            {
              facebookId: 'a-facebook-id',
            },
          );

          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({
            OR: [
              { createdBy: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
              { updatedBy: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' } },
            ],
          });
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
            selection.getAffectedGraphByNodeChange(creation)?.inputValue,
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
            selection.getAffectedGraphByNodeChange(deletion)?.inputValue,
          ).toEqual({ _id: 3 });
        });

        it('The updated "order", from 4 to 0, may change some document(s)', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            ArticleTag,
            {},
            {
              article: { _id: 4 },
              tag: { id: '764d2d19-c1da-41f4-8c31-f0fd0aa911df' },
              order: 4,
            },
            {
              order: 0,
            },
          );

          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({ _id: 4 });
        });

        it('The updated "order", from 4 to 5, does not change any document', () => {
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

          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });
      });

      describe('Tag', () => {
        it('The updated "deprecated", from NULL to TRUE, may change some document(s)', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            Tag,
            {},
            {
              id: '68f3d88d-1308-4019-8118-fc20042e8c20',
              title: 'My tag',
              slug: 'my-tag',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            {
              deprecated: true,
            },
          );

          expect(
            selection.getAffectedGraphByNodeChange(update)?.inputValue,
          ).toEqual({
            tags_some: { tag: { id: '68f3d88d-1308-4019-8118-fc20042e8c20' } },
          });
        });

        it('The updated "deprecated", from NULL to FALSE, does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            Tag,
            {},
            {
              id: '68f3d88d-1308-4019-8118-fc20042e8c20',
              title: 'My tag',
              slug: 'my-tag',
              createdAt: new Date('2021-01-01T00:00:00.000Z'),
              updatedAt: new Date('2021-01-01T00:00:00.000Z'),
            },
            {
              deprecated: false,
            },
          );

          expect(selection.getAffectedGraphByNodeChange(update)).toBeNull();
        });
      });
    });
  });
});
