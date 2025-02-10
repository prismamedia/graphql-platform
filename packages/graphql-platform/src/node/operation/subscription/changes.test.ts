import assert from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  ArticleStatus,
  type MyContext,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../index.js';
import {
  type NodeChange,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../change.js';
import { UnauthorizedError } from '../error.js';
import {
  type ChangesSubscriptionArgs,
  ChangesSubscriptionStream,
} from './changes.js';

describe('ChangesSubscription', () => {
  const gp = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [] }),
  });

  const Article = gp.getNodeByName('Article');
  const ArticleTag = gp.getNodeByName('ArticleTag');
  const Category = gp.getNodeByName('Category');
  const Tag = gp.getNodeByName('Tag');
  const User = gp.getNodeByName('User');
  const UserProfile = gp.getNodeByName('UserProfile');

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [myVisitorContext, { selection: { onUpsert: ['id'] } }],
      ] satisfies ReadonlyArray<[MyContext, ChangesSubscriptionArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          async () => gp.api.Article.subscribeToChanges(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { where: null, selection: { onUpsert: '{ id }' } }],
      ] satisfies ReadonlyArray<[MyContext, ChangesSubscriptionArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        await using subscription = await Article.api.subscribeToChanges(
          context,
          args,
        );

        assert(subscription instanceof ChangesSubscriptionStream);
        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });

    describe('with "pure" filter and selection', () => {
      let subscription: ChangesSubscriptionStream;

      before(async () => {
        subscription = await Article.api.subscribeToChanges(myAdminContext, {
          where: { status: ArticleStatus.PUBLISHED },
          selection: { onUpsert: `{ id title }`, onDeletion: `{ id }` },
        });
      });

      after(() => subscription.dispose());

      it('has a dependency-graph', () => {
        assert.deepStrictEqual(subscription.dependencyGraph.summary.toJSON(), {
          creations: ['Article'],
          deletions: ['Article'],
          componentsByNode: { Article: ['status', 'title'] },
          changes: ['Article'],
        });
      });

      const myRequestContext: MyContext = {};

      [
        NodeDeletion.createFromPartial(Article, myRequestContext, {
          id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
          _id: 1,
          status: ArticleStatus.DRAFT,
          slug: 'my-new-article',
          title: 'My new article',
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          score: 1,
        }),
        NodeCreation.createFromPartial(Article, myRequestContext, {
          id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
          _id: 1,
          status: ArticleStatus.DRAFT,
          slug: 'my-new-article',
          title: 'My new article',
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          score: 1,
        }),
        NodeUpdate.createFromPartial(
          Article,
          myRequestContext,
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
          { status: ArticleStatus.DELETED },
        ),
        NodeUpdate.createFromPartial(
          Article,
          myRequestContext,
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
      ].forEach((change) => {
        it('discards filtered-out change', () => {
          const dependentGraph =
            subscription.dependencyGraph.createDependentGraph([change]);

          assert(dependentGraph.isEmpty());
        });
      });

      it('handles filtered-in deletion', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeDeletion.createFromPartial(Article, myRequestContext, {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.PUBLISHED,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
      });

      it('handles filtered-in creation', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(Article, myRequestContext, {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.PUBLISHED,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
      });
    });

    describe('without "pure" filter or selection', () => {
      let subscription: ChangesSubscriptionStream;

      before(async () => {
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

      after(() => subscription.dispose());

      it('has a dependency-graph', () => {
        assert.deepStrictEqual(subscription.dependencyGraph.summary.toJSON(), {
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
        const myRequestContext: MyContext = {};

        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(Article, myRequestContext, {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.PUBLISHED,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
      });

      it('the "creation" might be an "upsert"', () => {
        const myRequestContext: MyContext = {};

        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(Article, myRequestContext, {
              id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
              _id: 1,
              status: ArticleStatus.DRAFT,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
      });
    });

    describe('with filter and/or selection on edge(s) and/or reverse-edge(s)', () => {
      let subscription: ChangesSubscriptionStream;

      before(async () => {
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
            tags_some: { tag: { deprecated_not: true } },
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

      after(() => subscription.dispose());

      it('has a dependency-graph', () => {
        assert.deepStrictEqual(subscription.dependencyGraph.summary.toJSON(), {
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

      const myRequestContext: MyContext = {};

      (
        [
          [
            NodeCreation.createFromPartial(User, myRequestContext, {
              id: '20c816d1-d390-45a1-9711-83697bc97766',
              username: 'test00',
              createdAt: new Date(),
              lastLoggedInAt: new Date(),
            }),
          ],
          [
            NodeDeletion.createFromPartial(User, myRequestContext, {
              id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
              username: 'test01',
              createdAt: new Date(),
              lastLoggedInAt: new Date(),
            }),
          ],
          [
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            }),
            NodeUpdate.createFromPartial(
              Article,
              myRequestContext,
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
          [
            NodeUpdate.createFromPartial(
              UserProfile,
              myRequestContext,
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
        ] satisfies ReadonlyArray<ReadonlyArray<NodeChange>>
      ).forEach((changes) => {
        it('discards those changes', () => {
          assert(
            subscription.dependencyGraph
              .createDependentGraph(changes)
              .isEmpty(),
          );
        });
      });

      it('discards the ArticleTag as the Article, filtered-in, is already visited', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            }),
            NodeCreation.createFromPartial(Article, myRequestContext, {
              id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
              _id: 5,
              status: ArticleStatus.PUBLISHED,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          upsertIfFounds: ['5'],
        });
      });

      it('discards the ArticleTag linked to the filtered-out Article', () => {
        const myRequestContext: MyContext = {};

        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            }),
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 5 },
              order: 2,
              tag: { id: 'df012a04-30aa-41e9-b929-6c73e6679ff4' },
            }),
            NodeCreation.createFromPartial(Article, myRequestContext, {
              id: '74a744c1-13d5-47aa-9006-52a05b72fa84',
              _id: 5,
              status: ArticleStatus.DRAFT,
              slug: 'my-new-article',
              title: 'My new article',
              createdAt: new Date(),
              updatedAt: new Date(),
              views: 0,
              score: 1,
            }),
            NodeCreation.createFromPartial(Tag, myRequestContext, {
              id: '3236f0ba-538a-43fa-a449-97d6cf244721',
              deprecated: true,
              title: 'My new tag',
              slug: 'my-new-tag',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            // Only this one should remain
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 10 },
              order: 1,
              tag: { id: 'df012a04-30aa-41e9-b929-6c73e6679ff4' },
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByReverseEdge: {
            tags: {
              upsertIfFounds: [
                '{\"article\":{\"_id\":10},\"tag\":{\"id\":\"df012a04-30aa-41e9-b929-6c73e6679ff4\"}}',
              ],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          _id: 10,
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          _id: 10,
        });
      });

      it('handles this Category "update"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeUpdate.createFromPartial(
              Category,
              myRequestContext,
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

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByEdge: { category: { upserts: ['5'] } },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          category: { _id: 5 },
        });
        assert.strictEqual(dependentGraph.filter?.graphFilter.inputValue, null);
      });

      it('handles this User "update"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeUpdate.createFromPartial(
              User,
              myRequestContext,
              {
                id: '284f48b1-da52-44d6-956b-4e085d7ab0f1',
                username: 'yvann',
                createdAt: new Date('2022-01-01T00:00:00.000Z'),
                lastLoggedInAt: new Date('2024-01-01T00:00:00.000Z'),
              },
              { lastLoggedInAt: new Date('2024-06-01T00:00:00.000Z') },
            ),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByEdge: {
            createdBy: {
              upsertIfFounds: ['\"284f48b1-da52-44d6-956b-4e085d7ab0f1\"'],
            },
            updatedBy: {
              upsertIfFounds: ['\"284f48b1-da52-44d6-956b-4e085d7ab0f1\"'],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          OR: [
            { createdBy: { id: '284f48b1-da52-44d6-956b-4e085d7ab0f1' } },
            { updatedBy: { username: 'yvann' } },
          ],
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
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
              myRequestContext,
              {
                id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
                username: 'test01',
                createdAt: new Date(),
                lastLoggedInAt: new Date('2022-07-01T00:00:00.000Z'),
              },
              { lastLoggedInAt: new Date('2023-03-01T00:00:00.000Z') },
            ),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByEdge: {
            createdBy: {
              upsertIfFounds: ['\"1a04ef91-104e-457e-829c-f4561f77f1e3\"'],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          createdBy: { id: '1a04ef91-104e-457e-829c-f4561f77f1e3' },
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          createdBy: { id: '1a04ef91-104e-457e-829c-f4561f77f1e3' },
        });
      });

      it('handles this ArticleTag "creation"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 4 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByReverseEdge: {
            tags: {
              upsertIfFounds: [
                '{\"article\":{\"_id\":4},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
              ],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          _id: 4,
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          _id: 4,
        });
      });

      it('handles this ArticleTag "deletion"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeDeletion.createFromPartial(ArticleTag, myRequestContext, {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByReverseEdge: {
            tags: {
              deletions: [
                '{\"article\":{\"_id\":5},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
              ],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          _id: 5,
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          _id: 5,
        });
      });

      it('handles this ArticleTag "update"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeUpdate.createFromPartial(
              ArticleTag,
              myRequestContext,
              {
                article: { _id: 6 },
                order: 1,
                tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
              },
              { order: 2 },
            ),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
          dependentsByReverseEdge: {
            tags: {
              upsertIfFounds: [
                '{\"article\":{\"_id\":6},\"tag\":{\"id\":\"75b1356c-6e88-4f94-9e84-1cd58c2afc23\"}}',
              ],
            },
          },
        });
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          _id: 6,
        });
        assert.strictEqual(dependentGraph.filter?.graphFilter.inputValue, null);
      });

      it('handles this UserProfile "creation"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeCreation.createFromPartial(UserProfile, myRequestContext, {
              user: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
              birthday: null,
              facebookId: null,
              googleId: null,
              twitterHandle: null,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
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
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          updatedBy: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          updatedBy: { id: '5da4ac5b-1620-4bfc-aacb-acf4011e7300' },
        });
      });

      it('handles this UserProfile "deletion"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeDeletion.createFromPartial(UserProfile, myRequestContext, {
              user: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
              birthday: null,
              facebookId: null,
              googleId: null,
              twitterHandle: null,
            }),
          ]);

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
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
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          updatedBy: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          updatedBy: { id: '16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2' },
        });
      });

      it('handles this UserProfile "update"', () => {
        const dependentGraph =
          subscription.dependencyGraph.createDependentGraph([
            NodeUpdate.createFromPartial(
              UserProfile,
              myRequestContext,
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

        assert(!dependentGraph.isEmpty());
        assert.deepStrictEqual(dependentGraph.toJSON(), {
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
        assert.deepStrictEqual(dependentGraph.graphFilter.inputValue, {
          createdBy: { id: '1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5' },
        });
        assert.deepStrictEqual(dependentGraph.filter?.graphFilter.inputValue, {
          createdBy: { id: '1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5' },
        });
      });
    });
  });
});
