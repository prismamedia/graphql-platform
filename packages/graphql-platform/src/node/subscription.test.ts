import { afterAll, describe, expect, it } from '@jest/globals';
import { ArticleStatus, myAdminContext, nodes } from '../__tests__/config.js';
import {
  GraphQLPlatform,
  NodeCreation,
  NodeDeletion,
  NodeFilter,
  NodeSubscription,
  createNodeUpdateFromComponentUpdates,
} from '../index.js';

describe('Subscription', () => {
  const gp = new GraphQLPlatform({ nodes });
  const Article = gp.getNodeByName('Article');
  const ArticleTag = gp.getNodeByName('ArticleTag');
  const User = gp.getNodeByName('User');
  const UserProfile = gp.getNodeByName('UserProfile');

  describe('Definition', () => {
    it('should ensure at least one "unique-constraint" is selected', () => {
      expect(() =>
        Article.subscribe(myAdminContext, { selection: '{ title }' }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"No immutable unique-constraint is selected"`,
      );
    });

    it('should ensure the defined "id" is selected', () => {
      expect(() =>
        Article.subscribe(myAdminContext, {
          uniqueConstraint: 'id',
          selection: '{ title }',
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"The "Article#id" unique-constraint is not selected"`,
      );
    });

    it('should guess a pure "id"', () => {
      const subscription = Article.subscribe(myAdminContext, {
        selection: '{ title id _id }',
      });

      expect(subscription).toBeInstanceOf(NodeSubscription);

      subscription.dispose();
    });

    it('should guess a composite "id"', () => {
      const subscription = ArticleTag.subscribe(myAdminContext, {
        selection: '{ order article { _id } tag { id } }',
      });

      expect(subscription).toBeInstanceOf(NodeSubscription);

      subscription.dispose();
    });
  });

  describe('Execution', () => {
    describe('with "pure" filter and selection', () => {
      const subscription = Article.subscribe(myAdminContext, {
        where: { status: ArticleStatus.PUBLISHED },
        selection: `{
          id
          title
        }`,
      });

      afterAll(() => subscription.dispose());

      it.each([
        new NodeDeletion(
          Article,
          {},
          {
            ...Object.fromEntries(
              Array.from(Article.componentSet, (component) => [
                component.name,
                null,
              ]),
            ),
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
        new NodeCreation(
          Article,
          {},
          {
            ...Object.fromEntries(
              Array.from(Article.componentSet, (component) => [
                component.name,
                null,
              ]),
            ),
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
        createNodeUpdateFromComponentUpdates(
          Article,
          {},
          {
            ...Object.fromEntries(
              Array.from(Article.componentSet, (component) => [
                component.name,
                null,
              ]),
            ),
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
        createNodeUpdateFromComponentUpdates(
          Article,
          {},
          {
            ...Object.fromEntries(
              Array.from(Article.componentSet, (component) => [
                component.name,
                null,
              ]),
            ),
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
          new NodeDeletion(
            Article,
            {},
            {
              ...Object.fromEntries(
                Array.from(Article.componentSet, (component) => [
                  component.name,
                  null,
                ]),
              ),
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
          new NodeCreation(
            Article,
            {},
            {
              ...Object.fromEntries(
                Array.from(Article.componentSet, (component) => [
                  component.name,
                  null,
                ]),
              ),
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
      const subscription = Article.subscribe(myAdminContext, {
        where: {
          OR: [
            { status: ArticleStatus.PUBLISHED },
            { category: { slug: 'my-selected-category' } },
            { category: { articleCount_gt: 0 } },
            { tags_some: { tag: { slug: 'my-selected-tag' } } },
            { tagCount_gte: 5 },
          ],
        },
        selection: `{
          id
          title
          category { title }
          tagCount(where: { tag: { deprecated_not: true } })
          tags(where: { tag: { deprecated_not: true } }, orderBy: [order_ASC], first: 10) { tag { title } }
        }`,
      });

      afterAll(() => subscription.dispose());

      it('the "creation" is an incomplete "upsert"', () => {
        const effect = subscription.getNodeChangesEffect(
          new NodeCreation(
            Article,
            {},
            {
              ...Object.fromEntries(
                Array.from(Article.componentSet, (component) => [
                  component.name,
                  null,
                ]),
              ),
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
          new NodeCreation(
            Article,
            {},
            {
              ...Object.fromEntries(
                Array.from(Article.componentSet, (component) => [
                  component.name,
                  null,
                ]),
              ),
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
      const subscription = Article.subscribe(myAdminContext, {
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
              articles_some: {
                article: {
                  updatedBy: {
                    lastLoggedInAt_gte: new Date('2023-01-01T00:00:00Z'),
                  },
                },
              },
              deprecated_not: true,
            },
          },
        },
        selection: `{
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
      });

      afterAll(() => subscription.dispose());

      it('has dependencies', () => {
        expect(subscription.dependencies?.debug()).toMatchInlineSnapshot(`
          {
            "category": {
              "title": undefined,
            },
            "createdBy": {
              "lastLoggedInAt": undefined,
              "profile": {
                "birthday": undefined,
                "user": undefined,
              },
              "username": undefined,
            },
            "id": undefined,
            "status": undefined,
            "tags": {
              "article": undefined,
              "order": undefined,
              "tag": {
                "articles": {
                  "article": {
                    "updatedBy": {
                      "lastLoggedInAt": undefined,
                    },
                  },
                  "tag": undefined,
                },
                "deprecated": undefined,
                "title": undefined,
              },
            },
            "title": undefined,
            "updatedBy": {
              "lastLoggedInAt": undefined,
              "profile": {
                "user": undefined,
              },
            },
          }
        `);
      });

      it('should skip this User "creation"', () =>
        expect(
          subscription.getNodeChangesEffect(
            new NodeCreation(
              User,
              {},
              {
                ...Object.fromEntries(
                  Array.from(User.componentSet, (component) => [
                    component.name,
                    null,
                  ]),
                ),
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
            new NodeDeletion(
              User,
              {},
              {
                ...Object.fromEntries(
                  Array.from(User.componentSet, (component) => [
                    component.name,
                    null,
                  ]),
                ),
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
          createNodeUpdateFromComponentUpdates(
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

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect?.graphChanges?.inputValue).toMatchInlineSnapshot(`
          {
            "OR": [
              {
                "tags_some": {
                  "tag": {
                    "articles_some": {
                      "article": {
                        "updatedBy": {
                          "username": "test01",
                        },
                      },
                    },
                  },
                },
              },
              {
                "createdBy": {
                  "id": "1a04ef91-104e-457e-829c-f4561f77f1e3",
                },
              },
            ],
          }
        `);
      });

      it('should handle this ArticleTag "creation"', () => {
        const effect = subscription.getNodeChangesEffect(
          new NodeCreation(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            },
          ),
        );

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "_id": 5,
          }
        `);
      });

      it('should handle this ArticleTag "deletion"', () => {
        const effect = subscription.getNodeChangesEffect(
          new NodeDeletion(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            },
          ),
        );

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "_id": 5,
          }
        `);
      });

      it('should handle this ArticleTag "update"', () => {
        const effect = subscription.getNodeChangesEffect(
          createNodeUpdateFromComponentUpdates(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            },
            { order: 2 },
          ),
        );

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "_id": 5,
          }
        `);
      });

      it('should handle this UserProfile "creation"', () => {
        const effect = subscription.getNodeChangesEffect(
          new NodeCreation(
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

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "OR": [
              {
                "createdBy": {
                  "id": "5da4ac5b-1620-4bfc-aacb-acf4011e7300",
                },
              },
              {
                "updatedBy": {
                  "id": "5da4ac5b-1620-4bfc-aacb-acf4011e7300",
                },
              },
            ],
          }
        `);
      });

      it('should handle this UserProfile "deletion"', () => {
        const effect = subscription.getNodeChangesEffect(
          new NodeDeletion(
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

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "OR": [
              {
                "createdBy": {
                  "id": "16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2",
                },
              },
              {
                "updatedBy": {
                  "id": "16f4dbff-b1e6-4c0b-b192-a0f4a4d51ec2",
                },
              },
            ],
          }
        `);
      });

      it('should skip this UserProfile "update"', () => {
        const effect = subscription.getNodeChangesEffect(
          createNodeUpdateFromComponentUpdates(
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

        expect(effect?.graphChanges).toBeUndefined();
      });

      it('should handle this UserProfile "update"', () => {
        const effect = subscription.getNodeChangesEffect(
          createNodeUpdateFromComponentUpdates(
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

        expect(effect?.graphChanges).toBeInstanceOf(NodeFilter);
        expect(effect!.graphChanges!.inputValue).toMatchInlineSnapshot(`
          {
            "createdBy": {
              "id": "1fc3ca20-8ac3-47e7-83e7-60b3ed7f87c5",
            },
          }
        `);
      });

      it('should skip the ArticleTag "creation" as an Article "creation" already handle it', () => {
        const effect = subscription.getNodeChangesEffect([
          new NodeCreation(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              order: 1,
              tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
            },
          ),
          new NodeCreation(
            ArticleTag,
            {},
            {
              article: { _id: 5 },
              order: 2,
              tag: { id: 'ad7092ac-f7d3-4f57-9a82-b5688256cb57' },
            },
          ),
          new NodeCreation(
            Article,
            {},
            {
              ...Object.fromEntries(
                Array.from(Article.componentSet, (component) => [
                  component.name,
                  null,
                ]),
              ),
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
        expect(effect?.graphChanges).toBeUndefined();
      });
    });
  });
});
