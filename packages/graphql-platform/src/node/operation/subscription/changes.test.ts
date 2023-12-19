import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import {
  ArticleStatus,
  MyContext,
  MyGP,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../index.js';
import { NodeCreation, NodeDeletion, NodeUpdate } from '../../change.js';
import { UnauthorizedError } from '../error.js';
import {
  ChangesSubscriptionArgs,
  ChangesSubscriptionStream,
} from './changes.js';

describe('ChangesSubscription', () => {
  const gp: MyGP = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [] }),
  });

  describe('Runtime', () => {
    const Article = gp.getNodeByName('Article');

    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, ChangesSubscriptionArgs]>([
        [myVisitorContext, { selection: { onUpsert: ['id'] } }],
      ])('throws an UnauthorizedError', (context, args) => {
        expect(() =>
          Article.api.subscribeToChanges(context, args),
        ).toThrowError(UnauthorizedError);

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      const Article = gp.getNodeByName('Article');
      const ArticleTag = gp.getNodeByName('ArticleTag');
      const User = gp.getNodeByName('User');
      const UserProfile = gp.getNodeByName('UserProfile');

      it.each<[MyContext, ChangesSubscriptionArgs]>([
        [myAdminContext, { where: null, selection: { onUpsert: '{ id }' } }],
      ])(
        'does no call the connector when it is not needed',
        (context, args) => {
          const subscription = Article.api.subscribeToChanges(context, args);
          expect(subscription).toBeInstanceOf(ChangesSubscriptionStream);

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
        },
      );

      describe('with "pure" filter and selection', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = Article.api.subscribeToChanges(myAdminContext, {
            where: { status: ArticleStatus.PUBLISHED },
            selection: {
              onUpsert: `{ id title }`,
              onDeletion: `{ id }`,
            },
          });

          await subscription.initialize();
        });

        afterAll(() => subscription?.dispose());

        it.each([
          NodeDeletion.createFromNonNullableComponents(
            Article,
            {},
            {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.DRAFT,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            },
          ),
          NodeCreation.createFromNonNullableComponents(
            Article,
            {},
            {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.DRAFT,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            },
          ),
          NodeUpdate.createFromNonNullableComponents(
            Article,
            {},
            {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.DRAFT,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            },
            {
              status: ArticleStatus.DELETED,
            },
          ),
          NodeUpdate.createFromNonNullableComponents(
            Article,
            {},
            {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.PUBLISHED,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            },
            { slug: 'my-updated-article' },
          ),
        ])('should discard filtered-out "change', (change) => {
          const effect = subscription.getNodeChangesEffect(change);

          expect(effect).toBeUndefined();
        });

        it('should handle filtered-in "deletion"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeDeletion.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
                _id: 1,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          );

          expect(effect?.deletions).toHaveLength(1);
        });

        it('should handle filtered-in "creation"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
                _id: 1,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          );

          expect(effect?.upserts).toHaveLength(1);
        });
      });

      describe('without "pure" filter or selection', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = Article.api.subscribeToChanges(myAdminContext, {
            where: {
              OR: [
                { status: ArticleStatus.PUBLISHED },
                { category: { slug: 'my-selected-category' } },
                { category: { articleCount_gt: 0 } },
                { tags_some: { tag: { slug: 'my-selected-tag' } } },
                { tagCount_gte: 5 },
              ],
            },
            selection: {
              onUpsert: `{
                id
                title
                category { title }
                tagCount(where: { tag: { deprecated_not: true } })
                tags(where: { tag: { deprecated_not: true } }, orderBy: [order_ASC], first: 10) { tag { title } }
                lowerCasedTitle
              }`,
              onDeletion: `{ id }`,
            },
          });
        });

        afterAll(() => subscription.dispose());

        it('the "creation" is an incomplete "upsert"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
                _id: 1,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          );

          expect(effect?.incompleteUpserts).toHaveLength(1);
        });

        it('the "creation" might be an "upsert"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
                _id: 1,
                status: ArticleStatus.DRAFT,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          );

          expect(effect?.maybeUpserts).toHaveLength(1);
        });
      });

      describe('with filter and/or selection on edge(s) and/or reverse-edge(s)', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = Article.api.subscribeToChanges(myAdminContext, {
            where: {
              status: ArticleStatus.PUBLISHED,
              NOT: {
                createdBy: {
                  lastLoggedInAt_gte: new Date('2023-01-01T00:00:00Z'),
                  profile: { birthday_gte: '2000-01-01' },
                },
                updatedBy: {
                  lastLoggedInAt_gte: new Date('2023-06-01T00:00:00Z'),
                  profile_is_null: false,
                },
              },
              tags_some: {
                tag: {
                  deprecated_not: true,
                },
              },
            },
            selection: {
              onUpsert: `{
                id
                title
                category {
                  title
                }
                createdBy {
                  username
                }
                tags(where: { tag: { deprecated_not: true }}, first: 10) {
                  tag {
                    title
                  }
                }
              }`,
              onDeletion: `{ id }`,
            },
          });
        });

        afterAll(() => subscription?.dispose());

        it('should skip this User "creation"', () =>
          expect(
            subscription.getNodeChangesEffect(
              NodeCreation.createFromNonNullableComponents(
                User,
                {},
                {
                  id: '20c816d1-d390-45a1-9711-83697bc97766',
                  username: 'test00',
                  createdAt: new Date(),
                  lastLoggedInAt: new Date(),
                },
              ),
            ),
          ).toBeUndefined());

        it('should skip this User "deletion"', () =>
          expect(
            subscription.getNodeChangesEffect(
              NodeDeletion.createFromNonNullableComponents(
                User,
                {},
                {
                  id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
                  username: 'test01',
                  createdAt: new Date(),
                  lastLoggedInAt: new Date(),
                },
              ),
            ),
          ).toBeUndefined());

        it('should handle this User "update"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeUpdate.createFromNonNullableComponents(
              User,
              {},
              {
                id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
                username: 'test01',
                createdAt: new Date(),
                lastLoggedInAt: new Date('2022-07-01T00:00:00.000Z'),
              },
              {
                lastLoggedInAt: new Date('2023-03-01T00:00:00.000Z'),
              },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "createdBy": {
                "id": "1a04ef91-104e-457e-829c-f4561f77f1e3",
              },
            }
          `);
        });

        it("should handle only the root-creation if a reverse-edge's head filtered-in creation is heading to it", () => {
          const effect = subscription.getNodeChangesEffect([
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
                _id: 5,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          ]);

          expect(effect?.maybeUpserts).toHaveLength(1);
          expect(effect?.maybeGraphChanges).toBeUndefined();
        });

        it("should handle only the root-creation if a reverse-edge's head filtered-out creation is heading to it", () => {
          const effect = subscription.getNodeChangesEffect([
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
                _id: 5,
                status: ArticleStatus.DRAFT,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          ]);

          expect(effect).toBeUndefined();
        });

        it('should handle only the root-update if a reverse-edge is heading to it', () => {
          const effect = subscription.getNodeChangesEffect([
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
            NodeUpdate.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
                _id: 5,
                status: ArticleStatus.DRAFT,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
              {
                status: ArticleStatus.DELETED,
              },
            ),
          ]);

          expect(effect).toBeUndefined();
        });

        it('should handle only the root-deletion if a reverse-edge is heading to it', () => {
          const effect = subscription.getNodeChangesEffect([
            NodeDeletion.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
            NodeDeletion.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
                _id: 5,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          ]);

          expect(effect?.deletions).toHaveLength(1);
          expect(effect?.maybeGraphChanges).toBeUndefined();
        });

        it('should handle this ArticleTag "creation"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 4 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "_id": 4,
            }
          `);
        });

        it('should handle this ArticleTag "deletion"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeDeletion.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "_id": 5,
            }
          `);
        });

        it('should handle this ArticleTag "update"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeUpdate.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 6 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
              { order: 2 },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "_id": 6,
            }
          `);
        });

        it('should handle this UserProfile "creation"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeCreation.createFromNonNullableComponents(
              UserProfile,
              {},
              {
                user: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
                birthday: null,
                facebookId: null,
                googleId: null,
                twitterHandle: null,
              },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "updatedBy": {
                "id": "5da4ac5b-1620-4bfc-aacb-acf4011e7300",
              },
            }
          `);
        });

        it('should handle this UserProfile "deletion"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeDeletion.createFromNonNullableComponents(
              UserProfile,
              {},
              {
                user: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
                birthday: null,
                facebookId: null,
                googleId: null,
                twitterHandle: null,
              },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "updatedBy": {
                "id": "16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2",
              },
            }
          `);
        });

        it('should skip this UserProfile "update"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeUpdate.createFromNonNullableComponents(
              UserProfile,
              {},
              {
                user: { id: 'ea379b2d-e1c6-4c17-9614-6a0492e195fe' },
                birthday: null,
                facebookId: null,
                googleId: null,
                twitterHandle: null,
              },
              { birthday: '1987-04-28' },
            ),
          );

          expect(effect?.maybeGraphChanges).toBeUndefined();
        });

        it('should handle this UserProfile "update"', () => {
          const effect = subscription.getNodeChangesEffect(
            NodeUpdate.createFromNonNullableComponents(
              UserProfile,
              {},
              {
                user: { id: '1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5' },
                birthday: null,
                facebookId: null,
                googleId: null,
                twitterHandle: null,
              },
              { birthday: '2019-12-09' },
            ),
          );

          expect(effect?.maybeGraphChanges?.filter.inputValue)
            .toMatchInlineSnapshot(`
            {
              "createdBy": {
                "id": "1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5",
              },
            }
          `);
        });

        it('should skip the ArticleTag "creation" as an Article "creation" already handle it', () => {
          const effect = subscription.getNodeChangesEffect([
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
            ),
            NodeCreation.createFromNonNullableComponents(
              ArticleTag,
              {},
              {
                article: { _id: 5 },
                order: 2,
                tag: { id: 'ad7092ac-f7d3-4f57-9a82-b5688256cb57' },
              },
            ),
            NodeCreation.createFromNonNullableComponents(
              Article,
              {},
              {
                id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
                _id: 5,
                status: ArticleStatus.PUBLISHED,
                slug: 'my-new-article',
                title: 'My new article',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              },
            ),
          ]);

          expect(effect?.maybeUpserts).toHaveLength(1);
          expect(effect?.maybeGraphChanges).toBeUndefined();
        });
      });
    });
  });
});
