import { after, before, describe, it } from 'node:test';
import {
  ArticleStatus,
  MyGP,
  myAdminContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  GraphQLPlatform,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../../index.js';
import { ChangesSubscriptionStream } from './changes.js';

describe('ChangesSubscription', () => {
  const gp: MyGP = new GraphQLPlatform({ nodes });

  describe('Runtime', () => {
    describe('Works', () => {
      const Article = gp.getNodeByName('Article');
      const ArticleTag = gp.getNodeByName('ArticleTag');
      const Tag = gp.getNodeByName('Tag');
      const User = gp.getNodeByName('User');
      const UserProfile = gp.getNodeByName('UserProfile');

      describe('with "pure" filter and selection', () => {
        let subscription: ChangesSubscriptionStream;

        before(async () => {
          subscription = await Article.api.subscribeToChanges(myAdminContext, {
            where: { status: ArticleStatus.PUBLISHED },
            selection: {
              onUpsert: `{ id title }`,
              onDeletion: `{ id }`,
            },
          });
        });

        after(() => subscription.dispose());

        it('has a dependency-graph', ({ assert }) => {
          assert.deepEqual(subscription.dependencyGraph.summary.toJSON(), {
            creations: ['Article'],
            deletions: ['Article'],
            componentsByNode: { Article: ['status', 'title'] },
            changes: ['Article'],
          });
        });

        [
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
        ].map((change, index) =>
          it(`discards filtered-out change - #${index}`, ({ assert }) => {
            const dependentGraph =
              subscription.dependencyGraph.createDependentGraph([change]);

            assert.equal(dependentGraph.isEmpty(), true);
          }),
        );

        it('handles filtered-in deletion', ({ assert }) => {
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

          assert.equal(dependentGraph.isEmpty(), false);
          assert.deepEqual(dependentGraph.toJSON(), {
            changes: ['Article/1/deletion'],
          });
        });

        it('handles filtered-in creation', ({ assert }) => {
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

          assert.equal(dependentGraph.isEmpty(), false);
          assert.deepEqual(dependentGraph.toJSON(), {
            changes: ['Article/1/creation'],
          });
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

        it('has a dependency-graph', ({ assert }) => {
          assert.deepEqual(subscription.dependencyGraph.summary.toJSON(), {
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

        after(() => subscription.dispose());

        it('has a dependency-graph', ({ assert }) => {
          assert.deepEqual(subscription.dependencyGraph.summary.toJSON(), {
            creations: ['Article', 'UserProfile', 'ArticleTag'],
            deletions: ['Article', 'UserProfile', 'ArticleTag'],
            componentsByNode: {
              Article: ['status', 'updatedBy', 'title', 'category'],
              ArticleTag: ['order'],
              Tag: ['deprecated'],
              User: ['lastLoggedInAt'],
              UserProfile: ['birthday'],
            },
            changes: ['Article', 'UserProfile', 'ArticleTag', 'User', 'Tag'],
          });
        });
      });
    });
  });
});
