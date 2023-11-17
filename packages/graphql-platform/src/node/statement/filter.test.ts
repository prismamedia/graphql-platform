import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import type { Node } from '../../node.js';
import { NodeCreation, NodeDeletion, NodeUpdate } from '../change.js';
import type { NodeFilterInputValue } from '../type/input/filter.js';
import type { NodeFilter } from './filter.js';

describe('Filter', () => {
  let gp: MyGP;

  let Article: Node;
  let ArticleExtension: Node;
  let UserProfile: Node;

  beforeAll(() => {
    gp = createMyGP();

    Article = gp.getNodeByName('Article');
    ArticleExtension = gp.getNodeByName('ArticleExtension');
    UserProfile = gp.getNodeByName('UserProfile');
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

    describe("Node-changes' effect", () => {
      let filter: NodeFilter;

      beforeAll(() => {
        filter = Article.filterInputType.parseAndFilter({
          title: 'My title',
          extension_is_null: false,
          category: {
            parent: {
              title: "My category's title",
            },
          },
          createdBy: {
            profile: {
              facebookId: 'my-facebook-id',
            },
            createdArticles_some: {
              title: "My created article's title",
            },
          },
          updatedBy: {
            profile: {
              twitterHandle: 'my-twitter-handle',
            },
            updatedArticles_some: {
              title: "My updated article's title",
            },
          },
        });
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

          expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
          expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });

        it('The updated "title" may change some document(s)', () => {
          {
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
                title: 'My other title',
              },
            );

            expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
            expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
              null,
            );
          }

          {
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
                title: 'My title',
              },
            );

            expect(filter.isAffectedByNodeUpdate(update)).toBe(true);
            expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
              null,
            );
          }

          {
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
                title: "My created article's title",
              },
            );

            expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
            expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
              null,
            );
          }
        });

        it('The updated "title" does not change any document if there is no "createdBy"', () => {
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
              title: "My created article's title",
            },
          );

          expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
          expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });

        it('The updated "title" may change some document(s) if there is a "createdBy"', () => {
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
              title: "My created article's title",
            },
          );

          expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
          expect(
            filter.getAffectedGraphByNodeChange(update).inputValue,
          ).toEqual({
            createdBy: { id: '9121c47b-87b6-4334-ae1d-4c9777e87576' },
          });
        });

        it('The updated "title" does not change any document if there is no "updatedBy"', () => {
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
              title: "My updated article's title",
            },
          );

          expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
          expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });

        it('The updated "title" may change some document(s) if there is an "updatedBy"', () => {
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
              title: "My updated article's title",
            },
          );

          expect(filter.isAffectedByNodeUpdate(update)).toBe(false);
          expect(
            filter.getAffectedGraphByNodeChange(update).inputValue,
          ).toEqual({ updatedBy: { username: 'yvann' } });
        });
      });

      describe('ArticleExtension', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromNonNullableComponents(
            ArticleExtension,
            {},
            {
              article: { _id: 4 },
              source: null,
            },
          );

          expect(
            filter.getAffectedGraphByNodeChange(creation).inputValue,
          ).toEqual({ _id: 4 });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromNonNullableComponents(
            ArticleExtension,
            {},
            {
              article: { _id: 5 },
              source: null,
            },
          );

          expect(
            filter.getAffectedGraphByNodeChange(deletion).inputValue,
          ).toEqual({ _id: 5 });
        });

        it('The updated "source" does not change any document', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            ArticleExtension,
            {},
            {
              article: { _id: 6 },
              source: null,
            },
            {
              source: 'A source',
            },
          );

          expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });
      });

      describe('UserProfile', () => {
        it('The creation may change some document(s)', () => {
          const creation = NodeCreation.createFromNonNullableComponents(
            UserProfile,
            {},
            {
              user: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' },
              facebookId: 'my-facebook-id',
            },
          );

          expect(
            filter.getAffectedGraphByNodeChange(creation).inputValue,
          ).toEqual({
            createdBy: { id: '16050880-dabc-4348-bd3b-d41efe1b6057' },
          });
        });

        it('The deletion may change some document(s)', () => {
          const deletion = NodeDeletion.createFromNonNullableComponents(
            UserProfile,
            {},
            {
              user: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' },
              facebookId: 'my-facebook-id',
            },
          );

          expect(
            filter.getAffectedGraphByNodeChange(deletion).inputValue,
          ).toEqual({
            createdBy: { id: '7caf940a-058a-4ef2-a8bf-ac2d6cae3485' },
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

          expect(filter.getAffectedGraphByNodeChange(update).inputValue).toBe(
            null,
          );
        });

        it('The updated "facebookId" may change some document(s)', () => {
          const update = NodeUpdate.createFromNonNullableComponents(
            UserProfile,
            {},
            {
              user: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
              facebookId: 'my-facebook-id',
            },
            {
              facebookId: 'another-facebook-id',
            },
          );

          expect(
            filter.getAffectedGraphByNodeChange(update).inputValue,
          ).toEqual({
            createdBy: { id: '8e3587e8-2e4e-46a4-a6e0-27f08aebb215' },
          });
        });
      });
    });
  });
});
