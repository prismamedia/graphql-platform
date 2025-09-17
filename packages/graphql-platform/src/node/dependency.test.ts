import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { ArticleStatus, nodes, type MyContext } from '../__tests__/config.js';
import { GraphQLPlatform } from '../index.js';
import {
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
  type NodeChange,
} from './change.js';
import { DocumentSetDependency, type DependentGraph } from './dependency.js';
import { MutationContextChanges } from './operation/mutation/context/changes.js';

describe('Dependency', () => {
  const gp = new GraphQLPlatform({ nodes });

  const Article = gp.getNodeByName('Article');
  const ArticleTag = gp.getNodeByName('ArticleTag');
  const ArticleTagModeration = gp.getNodeByName('ArticleTagModeration');
  const Category = gp.getNodeByName('Category');
  const Tag = gp.getNodeByName('Tag');
  const User = gp.getNodeByName('User');
  const UserProfile = gp.getNodeByName('UserProfile');

  const myRequestContext: MyContext = {};
  const changes = MutationContextChanges.createFromChanges([
    new NodeCreation(ArticleTag, myRequestContext, {
      article: { _id: 5 },
      order: 1,
      tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
    }),
    new NodeCreation(Article, myRequestContext, {
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
    new NodeCreation(User, myRequestContext, {
      id: '20c816d1-d390-45a1-9711-83697bc97766',
      username: 'test00',
      createdAt: new Date(),
      lastLoggedInAt: new Date(),
    }),
    new NodeDeletion(User, myRequestContext, {
      id: '1a04ef91-104e-457e-829c-f4561f77f1e3',
      username: 'test01',
      createdAt: new Date(),
      lastLoggedInAt: new Date(),
    }),
    new NodeCreation(ArticleTag, myRequestContext, {
      article: { _id: 5 },
      order: 1,
      tag: { id: '75b1356c-6e88-4f94-9e84-1cd58c2afc23' },
    }),
    new NodeUpdate(
      Article,
      myRequestContext,
      {
        id: '271f9c10-327f-4be3-8b3d-97bb78c0f4a6',
        _id: 6,
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
    new NodeUpdate(
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
    new NodeUpdate(
      Tag,
      myRequestContext,
      {
        id: '1a364d1e-6436-4ab8-815e-ed5cbb98bdcd',
        createdAt: new Date(),
        updatedAt: new Date(),
        deprecated: true,
        slug: 'my-tag',
        title: 'My tag',
      },
      { title: "My new tag's title" },
    ),
    new NodeCreation(Article, myRequestContext, {
      id: 'a3d00950-9f6a-4c19-9eb2-91d066926723',
      _id: 7,
      status: ArticleStatus.DRAFT,
      slug: 'breaking-news-article',
      title: 'Breaking News: Major Development',
      body: { blocks: [], entityMap: {} },
      category: { _id: 5 },
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      score: 0.8,
      highlighted: true,
      sponsored: false,
    }),
    new NodeUpdate(
      Article,
      myRequestContext,
      {
        id: '315f5bac-6a74-4aae-bd61-95f4e60a02b0',
        _id: 8,
        status: ArticleStatus.PUBLISHED,
        slug: 'tech-review',
        title: 'Tech Review: Latest Gadgets',
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 150,
        score: 0.9,
      },
      {
        title: 'Tech Review: Latest Gadgets!',
        views: 200,
        score: 0.95,
      },
    ),
    new NodeDeletion(Article, myRequestContext, {
      id: 'f9849d09-5d52-4b6b-ab55-10d2d7f15195',
      _id: 9,
      status: ArticleStatus.DRAFT,
      slug: 'old-article',
      title: 'Old Article to Delete',
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 5,
      score: 0.2,
    }),
    new NodeCreation(Article, myRequestContext, {
      id: '9cc24fcb-4037-4e34-8e8d-557bd6eb15bf',
      _id: 10,
      status: ArticleStatus.PUBLISHED,
      slug: 'featured-story',
      title: 'Featured Story: Innovation',
      body: { blocks: [], entityMap: {} },
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      score: 1.0,
      highlighted: true,
      sponsored: true,
      metas: { priority: 'high', featured: true },
    }),
    new NodeUpdate(
      Article,
      myRequestContext,
      {
        id: '0ade74f6-6b57-4c0a-9d14-947785e30bb5',
        _id: 11,
        status: ArticleStatus.DRAFT,
        slug: 'work-in-progress',
        title: 'Work in Progress Article',
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 0,
        score: 0.5,
      },
      {
        title: 'Updated Work in Progress Article',
        status: ArticleStatus.PUBLISHED,
        highlighted: true,
      },
    ),
    // Additional ArticleTag changes
    new NodeCreation(ArticleTag, myRequestContext, {
      article: { _id: 7 },
      order: 2,
      tag: { id: 'a1b2c3d4-e5f6-4789-9012-345678901234' },
    }),
    new NodeCreation(ArticleTag, myRequestContext, {
      article: { _id: 8 },
      order: 1,
      tag: { id: 'dd053657-4943-4781-9ccf-508806f8b01b' },
    }),
    new NodeUpdate(
      ArticleTag,
      myRequestContext,
      {
        article: { _id: 5 },
        order: 3,
        tag: { id: '348cf096-510f-4a3f-9309-390a525b5956' },
      },
      { order: 1 },
    ),
    new NodeDeletion(ArticleTag, myRequestContext, {
      article: { _id: 6 },
      order: 2,
      tag: { id: '1644415d-1cdd-49a9-b242-0bca05f64803' },
    }),
    new NodeCreation(ArticleTag, myRequestContext, {
      article: { _id: 10 },
      order: 1,
      tag: { id: '19a7d077-8a02-431f-9a84-ef1516675f17' },
    }),
    // Additional User changes
    new NodeCreation(User, myRequestContext, {
      id: 'cdff2e67-5655-41e5-8122-10b568272a38',
      username: 'newuser01',
      createdAt: new Date(),
      lastLoggedInAt: new Date(),
    }),
    new NodeUpdate(
      User,
      myRequestContext,
      {
        id: 'a207a3f6-474a-4ac9-8821-cc53bca56899',
        username: 'updateduser',
        createdAt: new Date(),
        lastLoggedInAt: new Date('2023-01-01T00:00:00Z'),
      },
      { lastLoggedInAt: new Date() },
    ),
    new NodeDeletion(User, myRequestContext, {
      id: '3b009aab-0427-4747-bf2d-99574cd91c7e',
      username: 'deleteduser',
      createdAt: new Date(),
      lastLoggedInAt: new Date(),
    }),
    new NodeCreation(User, myRequestContext, {
      id: '49ccf7d4-cc21-4cfc-ba21-73c2d64331e3',
      username: 'adminuser',
      createdAt: new Date(),
      lastLoggedInAt: new Date(),
    }),
    new NodeUpdate(
      User,
      myRequestContext,
      {
        id: '0f9e1c0d-0eae-4567-8607-d62a887f49af',
        username: 'frequentuser',
        createdAt: new Date(),
        lastLoggedInAt: new Date('2023-06-01T00:00:00Z'),
      },
      { lastLoggedInAt: new Date() },
    ),
    // Additional UserProfile changes
    new NodeCreation(UserProfile, myRequestContext, {
      user: { id: 'ae09ca2f-bbf3-413a-9a7b-a5802712db71' },
      birthday: '1990-05-15',
      facebookId: 'fb123456789',
      googleId: 'google123456789',
      twitterHandle: '@newuser01',
    }),
    new NodeUpdate(
      UserProfile,
      myRequestContext,
      {
        user: { id: '263741b9-24f0-4fb5-808c-26b0bde55971' },
        birthday: '1985-03-20',
        facebookId: null,
        googleId: 'google987654321',
        twitterHandle: '@updateduser',
      },
      {
        birthday: '1985-03-21',
        facebookId: 'fb987654321',
      },
    ),
    new NodeDeletion(UserProfile, myRequestContext, {
      user: { id: '3a517817-8c97-405f-94d5-4fa95d1770e5' },
      birthday: '1992-12-10',
      facebookId: 'fb555666777',
      googleId: null,
      twitterHandle: '@deleteduser',
    }),
    new NodeCreation(UserProfile, myRequestContext, {
      user: { id: 'd0f09d4a-1147-4f85-98ed-bcda3d7a0c69' },
      birthday: '1980-08-25',
      facebookId: 'fb111222333',
      googleId: 'google111222333',
      twitterHandle: '@adminuser',
    }),
    new NodeUpdate(
      UserProfile,
      myRequestContext,
      {
        user: { id: 'b29c9d00-2e02-4732-9491-b4879c2eb5b3' },
        birthday: '1988-11-30',
        facebookId: null,
        googleId: null,
        twitterHandle: null,
      },
      {
        birthday: '1988-12-01',
        twitterHandle: '@frequentuser',
      },
    ),
    // Additional Tag changes
    new NodeCreation(Tag, myRequestContext, {
      id: 'd18843a5-dcf2-4629-ae91-4850cef7d503',
      title: 'Technology',
      slug: 'technology',
      deprecated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    new NodeUpdate(
      Tag,
      myRequestContext,
      {
        id: 'e9937c6e-b774-4b40-91c1-794b53ccb771',
        title: 'Science',
        slug: 'science',
        deprecated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Advanced Science',
        deprecated: true,
      },
    ),
    new NodeDeletion(Tag, myRequestContext, {
      id: '7a4500da-e8b3-4e9e-bbfc-882259be3b3f',
      title: 'Old Tag',
      slug: 'old-tag',
      deprecated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    new NodeCreation(Tag, myRequestContext, {
      id: '67e21bbb-707a-40eb-846b-85f0f0257cd5',
      title: 'Innovation',
      slug: 'innovation',
      deprecated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    new NodeUpdate(
      Tag,
      myRequestContext,
      {
        id: 'd919d8aa-31a9-451b-adfe-b903e39f0427',
        title: 'Business',
        slug: 'business',
        deprecated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Business & Finance',
        slug: 'business-finance',
      },
    ),
    // Additional Category changes
    new NodeCreation(Category, myRequestContext, {
      id: 'c44f6872-b083-40ae-b1a8-5d726473a35d',
      _id: 12,
      title: 'Sports',
      slug: 'sports',
      order: 1,
    }),
    new NodeUpdate(
      Category,
      myRequestContext,
      {
        id: '2051b472-7792-4621-acb4-d68357446bf3',
        _id: 13,
        title: 'Entertainment',
        slug: 'entertainment',
        order: 2,
      },
      {
        title: 'Entertainment & Media',
        order: 3,
      },
    ),
    new NodeDeletion(Category, myRequestContext, {
      id: 'a085f374-41fc-4dd6-b7dd-39a801862ac3',
      _id: 14,
      title: 'Old Category',
      slug: 'old-category',
      order: 4,
    }),
    new NodeCreation(Category, myRequestContext, {
      id: '8394bbb0-5526-4e8d-bc57-6a93bdd0b707',
      _id: 15,
      title: 'Health',
      slug: 'health',
      parent: { _id: 12 },
      order: 1,
    }),
    new NodeUpdate(
      Category,
      myRequestContext,
      {
        id: '1acac733-efa5-4be3-b248-fd9ad7ba8bdf',
        _id: 16,
        title: 'Education',
        slug: 'education',
        order: 5,
      },
      {
        title: 'Education & Learning',
        order: 6,
      },
    ),
    // Additional ArticleTagModeration changes
    new NodeCreation(ArticleTagModeration, myRequestContext, {
      articleTag: {
        article: { _id: 7 },
        tag: { id: '1b5688b2-2a6d-48bc-a1c6-77015a2994ba' },
      },
      moderator: { id: '1aac936d-65e8-49ff-90ac-581a8835eebf' },
      moderation: 'Approved for publication',
    }),
    new NodeUpdate(
      ArticleTagModeration,
      myRequestContext,
      {
        articleTag: {
          article: { _id: 8 },
          tag: { id: '3c278a21-fa82-49f4-9bf3-6d88ce8cec2d' },
        },
        moderator: { id: '417d6b8c-779b-4515-9114-27fc976a4753' },
        moderation: 'Needs review',
      },
      { moderation: 'Approved after review' },
    ),
    new NodeDeletion(ArticleTagModeration, myRequestContext, {
      articleTag: {
        article: { _id: 9 },
        tag: { id: '2a7b118a-0a81-4eeb-b43e-1f95e91ac0a9' },
      },
      moderator: { id: '79e2af73-d9a2-4ee6-a68f-f6d70878b52d' },
      moderation: 'Rejected content',
    }),
  ]);

  let dependencyTree: DocumentSetDependency;
  let dependentGraph: DependentGraph | undefined;

  describe('Pure', () => {
    before(() => {
      dependencyTree = new DocumentSetDependency(Article, {
        filter: Article.filterInputType.filter({
          status_in: [ArticleStatus.DRAFT, ArticleStatus.DELETED],
        }),
        selection: Article.outputType.select(`{
          id
          title
        }`),
      });
    });

    it('has a consistent dependency-tree', (t) => {
      t.assert.snapshot(dependencyTree.flattened.toJSON());
    });

    describe('discards these changes', () => {
      (
        [
          [
            'filtered-out',
            new NodeUpdate(
              Article,
              myRequestContext,
              {
                id: '315f5bac-6a74-4aae-bd61-95f4e60a02b0',
                _id: 8,
                status: ArticleStatus.DRAFT,
                slug: 'tech-review',
                title: 'Tech Review: Latest Gadgets',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 150,
                score: 0.9,
              },
              {
                status: ArticleStatus.DELETED,
                views: 200,
                score: 0.95,
              },
            ),
          ],
          [
            'only the filter depends on it but its value is not actually changed',
            new NodeUpdate(
              Article,
              myRequestContext,
              {
                id: '315f5bac-6a74-4aae-bd61-95f4e60a02b0',
                _id: 8,
                status: ArticleStatus.PREVIEW,
                slug: 'tech-review',
                title: 'Tech Review: Latest Gadgets',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 150,
                score: 0.9,
              },
              {
                status: ArticleStatus.PUBLISHED,
              },
            ),
          ],
          [
            'nothing depends on it',
            new NodeUpdate(
              Article,
              myRequestContext,
              {
                id: '315f5bac-6a74-4aae-bd61-95f4e60a02b0',
                _id: 8,
                status: ArticleStatus.PUBLISHED,
                slug: 'tech-review',
                title: 'Tech Review: Latest Gadgets',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 150,
                score: 0.9,
              },
              {
                slug: 'tech-review-updated',
              },
            ),
          ],
          [
            'the selection depends on it, but its value is not actually changed',
            new NodeUpdate(
              Tag,
              myRequestContext,
              {
                id: '1a364d1e-6436-4ab8-815e-ed5cbb98bdcd',
                createdAt: new Date(),
                updatedAt: new Date(),
                deprecated: null,
                slug: 'my-tag',
                title: 'My tag',
              },
              { deprecated: false },
            ),
          ],
        ] satisfies ReadonlyArray<[string, utils.ReadonlyArrayable<NodeChange>]>
      ).forEach(([reason, changes]) =>
        it(reason, (t) => {
          t.assert.equal(
            dependencyTree
              .createDependentGraph(
                MutationContextChanges.createFromChanges(changes),
              )
              ?.toJSON(),
            undefined,
          );
        }),
      );
    });

    describe('produces a dependent-graph', () => {
      before(() => {
        dependentGraph = dependencyTree.createDependentGraph(changes);
      });

      it('summary', (t) => {
        t.assert.snapshot(dependentGraph?.toJSON());
      });

      it('deletion-filter', () => {
        assert(dependentGraph?.deletionFilter.isFalse());
      });

      it('upsert-filter', (t) => {
        t.assert.snapshot(dependentGraph?.graphFilter.inputValue);
      });
    });
  });

  describe('With virtual-selection', () => {
    before(() => {
      dependencyTree = new DocumentSetDependency(Article, {
        selection: Article.outputType.select(`{
          id
          title
          lowerCasedTitle
          upperCasedTitle
        }`),
      });
    });

    it('has a consistent dependency-tree', (t) => {
      t.assert.snapshot(dependencyTree.flattened.toJSON());
    });

    describe('produces a dependent-graph', () => {
      before(() => {
        dependentGraph = dependencyTree.createDependentGraph(changes);
      });

      it('summary', (t) => {
        t.assert.snapshot(dependentGraph?.toJSON());
      });

      it('deletion-filter', () => {
        assert(dependentGraph?.deletionFilter.isFalse());
      });

      it('upsert-filter', (t) => {
        t.assert.snapshot(dependentGraph?.graphFilter.inputValue);
      });
    });
  });

  describe('Complex filter', () => {
    before(() => {
      dependencyTree = new DocumentSetDependency(Article, {
        filter: Article.filterInputType.filter({
          status: ArticleStatus.PUBLISHED,
          tags_some: { tag: { deprecated_not: true } },
        }),
        selection: Article.outputType.select(`{
          id
          title
          category {
            title
          }
        }`),
      });
    });

    it('has a consistent dependency-tree', (t) => {
      t.assert.snapshot(dependencyTree.flattened.toJSON());
    });

    describe('produces a dependent-graph', () => {
      before(() => {
        dependentGraph = dependencyTree.createDependentGraph(changes);
      });

      it('summary', (t) => {
        t.assert.snapshot(dependentGraph?.toJSON());
      });

      it('deletion-filter', (t) => {
        t.assert.snapshot(dependentGraph?.deletionFilter.inputValue);
      });

      it('upsert-filter', (t) => {
        t.assert.snapshot(dependentGraph?.graphFilter.inputValue);
      });
    });
  });

  describe('Complex filter & selection', () => {
    before(() => {
      dependencyTree = new DocumentSetDependency(Article, {
        filter: Article.filterInputType.filter({
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
        }),
        selection: Article.outputType.select(`{
          id
          title
          category {
            order
            title
            children(first: 10) {
              order
              title
            }
          }
          createdBy {
            username
          }
          a: tags(where: { tag: { deprecated_not: true }}, first: 5) {
            tag {
              slug
            }
            moderations(first: 10) { moderation }
          }
          b: tags(where: { tag: { deprecated: true }}, first: 10) {
            tag {
              title
            }
          }
          extension { source }
        }`),
      });
    });

    it('has a consistent dependency-tree', (t) => {
      t.assert.snapshot(dependencyTree.flattened.toJSON());
    });

    describe('discards these changes', () => {
      (
        [
          [
            'filtered-out',
            new NodeUpdate(
              Article,
              myRequestContext,
              {
                id: '25f818b8-f243-4842-90a5-6a7d85e3596a',
                _id: 8,
                status: ArticleStatus.DRAFT,
                slug: 'tech-review',
                title: 'Tech Review: Latest Gadgets',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 150,
                score: 0.9,
              },
              {
                status: ArticleStatus.DELETED,
              },
            ),
          ],
          [
            'nothing depends on it',
            new NodeUpdate(
              Article,
              myRequestContext,
              {
                id: '315f5bac-6a74-4aae-bd61-95f4e60a02b0',
                _id: 8,
                status: ArticleStatus.PUBLISHED,
                slug: 'tech-review',
                title: 'Tech Review: Latest Gadgets',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 150,
                score: 0.9,
              },
              {
                slug: 'tech-review-updated',
              },
            ),
          ],
          [
            "the filter's value is not actually changed",
            new NodeUpdate(
              Tag,
              myRequestContext,
              {
                id: '1a364d1e-6436-4ab8-815e-ed5cbb98bdcd',
                createdAt: new Date(),
                updatedAt: new Date(),
                deprecated: null,
                slug: 'my-tag',
                title: 'My tag',
              },
              { deprecated: false },
            ),
          ],
          [
            "the selection depends on the title, but the parent's filter discards the change",
            new NodeUpdate(
              Tag,
              myRequestContext,
              {
                id: '1a364d1e-6436-4ab8-815e-ed5cbb98bdcd',
                createdAt: new Date(),
                updatedAt: new Date(),
                deprecated: false,
                slug: 'my-tag',
                title: 'My tag',
              },
              { title: 'My new title' },
            ),
          ],
          [
            "the selection depends on the title, but the parent's filter discards the change",
            new NodeUpdate(
              Tag,
              myRequestContext,
              {
                id: '1a364d1e-6436-4ab8-815e-ed5cbb98bdcd',
                createdAt: new Date(),
                updatedAt: new Date(),
                deprecated: true,
                slug: 'my-tag',
                title: 'My tag',
              },
              { slug: 'my-new-slug' },
            ),
          ],
          [
            'as the "parent" edge is null, it does not affect the "children" reverse-edge',
            new NodeCreation(Category, myRequestContext, {
              id: 'c44f6872-b083-40ae-b1a8-5d726473a35d',
              _id: 12,
              title: 'Sports',
              slug: 'sports',
              order: 1,
            }),
          ],
          [
            'the ArticleTag is connected to the filtered-out Article',
            [
              new NodeCreation(Article, myRequestContext, {
                _id: 44,
                id: 'a7f6602d-b461-4e09-8a87-13bfcb91d428',
                status: ArticleStatus.DRAFT,
                slug: 'my-draft',
                title: 'My draft',
                createdAt: new Date(),
                updatedAt: new Date(),
                views: 0,
                score: 1,
              }),
              new NodeCreation(ArticleTag, myRequestContext, {
                article: { _id: 44 },
                order: 1,
                tag: { id: '88383e6b-91f5-4d80-b134-3fcce8ae5789' },
              }),
            ],
          ],
        ] satisfies ReadonlyArray<[string, utils.ReadonlyArrayable<NodeChange>]>
      ).forEach(([reason, changes]) =>
        it(reason, (t) => {
          t.assert.equal(
            dependencyTree
              .createDependentGraph(
                MutationContextChanges.createFromChanges(changes),
              )
              ?.toJSON(),
            undefined,
          );
        }),
      );
    });

    describe('produces a dependent-graph', () => {
      before(() => {
        dependentGraph = dependencyTree.createDependentGraph(changes);
      });

      it('summary', (t) => {
        t.assert.snapshot(dependentGraph?.toJSON());
      });

      it('deletion-filter', (t) => {
        t.assert.snapshot(dependentGraph?.deletionFilter.inputValue);
      });

      it('upsert-filter', (t) => {
        t.assert.snapshot(dependentGraph?.graphFilter.inputValue);
      });
    });
  });
});
