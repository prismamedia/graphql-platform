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
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from '../../change.js';
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
        expect(() => Article.api.subscribeToChanges(context, args)).toThrow(
          UnauthorizedError,
        );

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      const Article = gp.getNodeByName('Article');
      const ArticleTag = gp.getNodeByName('ArticleTag');
      const Category = gp.getNodeByName('Category');
      const Tag = gp.getNodeByName('Tag');
      const User = gp.getNodeByName('User');
      const UserProfile = gp.getNodeByName('UserProfile');

      it.each<[MyContext, ChangesSubscriptionArgs]>([
        [myAdminContext, { where: null, selection: { onUpsert: '{ id }' } }],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await using subscription = await Article.api.subscribeToChanges(
            context,
            args,
          );
          expect(subscription).toBeInstanceOf(ChangesSubscriptionStream);

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
        },
      );

      describe('with "pure" filter and selection', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = await Article.api.subscribeToChanges(myAdminContext, {
            where: { status: ArticleStatus.PUBLISHED },
            selection: {
              onUpsert: `{ id title }`,
              onDeletion: `{ id }`,
            },
          });
        });

        afterAll(() => subscription.dispose());

        it('has a dependency-graph', () => {
          expect(subscription.dependencyGraph.summary.toJSON()).toEqual({
            creations: ['Article'],
            deletions: ['Article'],
            componentsByNode: { Article: ['status', 'title'] },
            changes: ['Article'],
          });
        });

        it.each([
          NodeDeletion.createFromPartial(
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
          NodeCreation.createFromPartial(
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
          NodeUpdate.createFromPartial(
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
          NodeUpdate.createFromPartial(
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
        ])('discards filtered-out change', (change) => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([change]);

          expect(dependentGraph.isEmpty()).toBeTruthy();
        });

        it('handles filtered-in deletion', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeDeletion.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
        });

        it('handles filtered-in creation', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
        });
      });

      describe('without "pure" filter or selection', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = await Article.api.subscribeToChanges(myAdminContext, {
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

        it('has a dependency-graph', () => {
          expect(subscription.dependencyGraph.summary.toJSON()).toEqual({
            creations: ['Article', 'ArticleTag'],
            deletions: ['Article', 'ArticleTag'],
            componentsByNode: {
              Article: ['status', 'category', 'title'],
              ArticleTag: ['order'],
              Tag: ['deprecated'],
            },
            changes: ['Article', 'ArticleTag', 'Tag'],
          });
        });

        it('the "creation" is an incomplete "upsert"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
        });

        it('the "creation" might be an "upsert"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
        });
      });

      describe('with filter and/or selection on edge(s) and/or reverse-edge(s)', () => {
        let subscription: ChangesSubscriptionStream;

        beforeAll(async () => {
          subscription = await Article.api.subscribeToChanges(myAdminContext, {
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
                  order
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

        afterAll(() => subscription.dispose());

        it('has a dependency-graph', () => {
          expect(subscription.dependencyGraph.summary.toJSON()).toEqual({
            creations: ['Article', 'UserProfile', 'ArticleTag'],
            deletions: ['Article', 'UserProfile', 'ArticleTag'],
            componentsByNode: {
              Article: ['status', 'updatedBy', 'title', 'category'],
              ArticleTag: ['order'],
              Category: ['order'],
              Tag: ['deprecated'],
              User: ['lastLoggedInAt'],
              UserProfile: ['birthday'],
            },
            changes: [
              'Article',
              'UserProfile',
              'ArticleTag',
              'User',
              'Category',
              'Tag',
            ],
          });
        });

        it.each<[ReadonlyArray<NodeChange>]>([
          [
            [
              NodeCreation.createFromPartial(
                User,
                {},
                {
                  id: '20c816d1-d390-45a1-9711-83697bc97766',
                  username: 'test00',
                  createdAt: new Date(),
                  lastLoggedInAt: new Date(),
                },
              ),
            ],
          ],
          [
            [
              NodeDeletion.createFromPartial(
                User,
                {},
                {
                  id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
                  username: 'test01',
                  createdAt: new Date(),
                  lastLoggedInAt: new Date(),
                },
              ),
            ],
          ],
          [
            [
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 5 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
              ),
              NodeUpdate.createFromPartial(
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
                { status: ArticleStatus.DELETED },
              ),
            ],
          ],
          [
            [
              NodeUpdate.createFromPartial(
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
            ],
          ],
        ])('discards those changes', (changes) => {
          expect(
            subscription.dependencyGraph
              .createDependentGraph(changes)
              .isEmpty(),
          ).toBeTruthy();
        });

        it('discards the ArticleTag as the Article, filtered-in, is already visited', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 5 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
              ),
              NodeCreation.createFromPartial(
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

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            upsertIfFounds: ['5'],
          });
        });

        it('discards the ArticleTag linked to the filtered-out Article', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 5 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
              ),
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 5 },
                  order: 2,
                  tag: { id: 'df012a04-30aa-41e9-b929-6c73e6679ff4' },
                },
              ),
              NodeCreation.createFromPartial(
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
              NodeCreation.createFromPartial(
                Tag,
                {},
                {
                  id: '3236f0ba-538a-43fa-a449-97d6cf244721',
                  deprecated: true,
                  title: 'My new tag',
                  slug: 'my-new-tag',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ),
              // Only this one should remain
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 10 },
                  order: 1,
                  tag: { id: 'df012a04-30aa-41e9-b929-6c73e6679ff4' },
                },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByReverseEdge: {
              tags: {
                upsertIfFounds: [
                  '{\"article\":{\"_id\":10},\"tag\":{\"id\":\"df012a04-30aa-41e9-b929-6c73e6679ff4\"}}',
                ],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({ _id: 10 });
          expect(dependentGraph.filter?.target.inputValue).toEqual({ _id: 10 });
        });

        it('handles this Category "update"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeUpdate.createFromPartial(
                Category,
                {},
                {
                  _id: 5,
                  id: '4ec44772-4c3d-4c6f-bec0-8721c66fb77e',
                  title: 'My category',
                  slug: 'my-category',
                  order: 1,
                },
                { order: 2 },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              category: {
                upserts: ['5'],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            category: { _id: 5 },
          });
          expect(dependentGraph.filter?.target.inputValue).toBeNull();
        });

        it('handles this User "update"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeUpdate.createFromPartial(
                User,
                {},
                {
                  id: '284f48b1-da52-44d6-956b-4e085d7ab0f1',
                  username: 'yvann',
                  createdAt: new Date('2022-01-01T00:00:00.000Z'),
                  lastLoggedInAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                { lastLoggedInAt: new Date('2024-06-01T00:00:00.000Z') },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              createdBy: {
                upsertIfFounds: ['\"284f48b1-da52-44d6-956b-4e085d7ab0f1\"'],
              },
              updatedBy: {
                upsertIfFounds: ['\"284f48b1-da52-44d6-956b-4e085d7ab0f1\"'],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            OR: [
              { createdBy: { id: '284f48b1-da52-44d6-956b-4e085d7ab0f1' } },
              { updatedBy: { username: 'yvann' } },
            ],
          });
          expect(dependentGraph.filter?.target.inputValue).toEqual({
            OR: [
              { createdBy: { id: '284f48b1-da52-44d6-956b-4e085d7ab0f1' } },
              { updatedBy: { username: 'yvann' } },
            ],
          });
        });

        it('handles this User "update"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeUpdate.createFromPartial(
                User,
                {},
                {
                  id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
                  username: 'test01',
                  createdAt: new Date(),
                  lastLoggedInAt: new Date('2022-07-01T00:00:00.000Z'),
                },
                { lastLoggedInAt: new Date('2023-03-01T00:00:00.000Z') },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              createdBy: {
                upsertIfFounds: ['\"1a04ef91-104e-457e-829c-f4561f77f1e3\"'],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            createdBy: { id: '1a04ef91-104e-457e-829c-f4561f77f1e3' },
          });
          expect(dependentGraph.filter?.target.inputValue).toEqual({
            createdBy: { id: '1a04ef91-104e-457e-829c-f4561f77f1e3' },
          });
        });

        it('handles this ArticleTag "creation"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 4 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByReverseEdge: {
              tags: {
                upsertIfFounds: [
                  '{\"article\":{\"_id\":4},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
                ],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({ _id: 4 });
          expect(dependentGraph.filter?.target.inputValue).toEqual({ _id: 4 });
        });

        it('handles this ArticleTag "deletion"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeDeletion.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 5 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByReverseEdge: {
              tags: {
                deletions: [
                  '{\"article\":{\"_id\":5},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
                ],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({ _id: 5 });
          expect(dependentGraph.filter?.target.inputValue).toEqual({ _id: 5 });
        });

        it('handles this ArticleTag "update"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeUpdate.createFromPartial(
                ArticleTag,
                {},
                {
                  article: { _id: 6 },
                  order: 1,
                  tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
                },
                { order: 2 },
              ),
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByReverseEdge: {
              tags: {
                upsertIfFounds: [
                  '{\"article\":{\"_id\":6},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
                ],
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({ _id: 6 });
          expect(dependentGraph.filter?.target.inputValue).toBeNull();
        });

        it('handles this UserProfile "creation"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeCreation.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              updatedBy: {
                dependentsByReverseEdge: {
                  profile: {
                    upserts: [
                      '{\"user\":{\"id\":\"5da4ac5b-1620-4bfc-aacb-acf4011e7300\"}}',
                    ],
                  },
                },
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            updatedBy: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
          });
          expect(dependentGraph.filter?.target.inputValue).toEqual({
            updatedBy: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
          });
        });

        it('handles this UserProfile "deletion"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeDeletion.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              updatedBy: {
                dependentsByReverseEdge: {
                  profile: {
                    deletions: [
                      '{\"user\":{\"id\":\"16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2\"}}',
                    ],
                  },
                },
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            updatedBy: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
          });
          expect(dependentGraph.filter?.target.inputValue).toEqual({
            updatedBy: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
          });
        });

        it('handles this UserProfile "update"', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([
              NodeUpdate.createFromPartial(
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
            ]);

          expect(dependentGraph.isEmpty()).toBeFalsy();
          expect(dependentGraph.toJSON()).toEqual({
            dependentsByEdge: {
              createdBy: {
                dependentsByReverseEdge: {
                  profile: {
                    upserts: [
                      '{\"user\":{\"id\":\"1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5\"}}',
                    ],
                  },
                },
              },
            },
          });
          expect(dependentGraph.target.inputValue).toEqual({
            createdBy: { id: '1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5' },
          });
          expect(dependentGraph.filter?.target.inputValue).toEqual({
            createdBy: { id: '1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5' },
          });
        });
      });
    });
  });
});
