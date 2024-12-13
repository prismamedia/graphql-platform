import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  GraphQLPlatform,
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../index.js';

describe('Change', () => {
  type MyTestRequestContext = {};
  let myContext = {} satisfies MyTestRequestContext;

  let gp: GraphQLPlatform<MyTestRequestContext>;

  before(() => {
    gp = new GraphQLPlatform({
      nodes: {
        Article: {
          components: {
            id: {
              type: 'UUIDv4',
              nullable: false,
              mutable: false,
            },
            title: {
              type: 'String',
            },
          },
          uniques: [['id']],
          reverseEdges: { tags: { originalEdge: 'ArticleTag.article' } },
        },
        Tag: {
          components: {
            id: {
              type: 'UnsignedInt',
              nullable: false,
              mutable: false,
            },
            title: {
              type: 'String',
            },
          },
          uniques: [['id']],
          reverseEdges: { articles: { originalEdge: 'ArticleTag.tag' } },
        },
        ArticleTag: {
          components: {
            article: {
              kind: 'Edge',
              head: 'Article',
              nullable: false,
              mutable: false,
            },
            tag: {
              kind: 'Edge',
              head: 'Tag',
              nullable: false,
              mutable: false,
            },
            order: {
              type: 'UnsignedInt',
              nullable: false,
            },
          },
          uniques: [['article', 'tag']],
        },
      },
    });
  });

  it('throws an error on invalid change', () => {
    const Article = gp.getNodeByName('Article');
    const Tag = gp.getNodeByName('Tag');
    const ArticleTag = gp.getNodeByName('ArticleTag');

    assert.throws(() => new NodeCreation(Article, myContext, {}), {
      message: /^\/Article - 2 errors:/,
    });
    assert.throws(() => new NodeCreation(Tag, myContext, {}), {
      message: /^\/Tag - 2 errors:/,
    });
    assert.throws(() => new NodeCreation(ArticleTag, myContext, {}), {
      message: /^\/ArticleTag - 3 errors:/,
    });
  });

  it('aggregates changes', () => {
    const Article = gp.getNodeByName('Article');
    const Tag = gp.getNodeByName('Tag');
    const ArticleTag = gp.getNodeByName('ArticleTag');

    using aggregate = new NodeChangeAggregation([
      // These 2 changes are aggregated
      new NodeCreation(Article, myContext, {
        id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12',
        title: 'My title',
      }),
      new NodeUpdate(
        Article,
        myContext,
        { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12', title: 'My title' },
        { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12', title: 'My new title' },
      ),
      // These 2 changes are removed
      new NodeCreation(Article, myContext, {
        id: 'a642c6e3-e477-45da-bd0d-0351a2b086a0',
        title: 'My other title',
      }),
      new NodeDeletion(Article, myContext, {
        id: 'a642c6e3-e477-45da-bd0d-0351a2b086a0',
        title: 'My other title',
      }),
      new NodeCreation(Tag, myContext, {
        id: 1,
        title: 'My first tag',
      }),
      // These 2 changes are aggregated
      new NodeCreation(ArticleTag, myContext, {
        article: { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12' },
        tag: { id: 1 },
        order: 1,
      }),
      new NodeUpdate(
        ArticleTag,
        myContext,
        {
          article: { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12' },
          tag: { id: 1 },
          order: 1,
        },
        {
          article: { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12' },
          tag: { id: 1 },
          order: 2,
        },
      ),
      // These 2 changes are removed
      new NodeUpdate(
        Article,
        myContext,
        { id: 'fbc99af4-429d-49fd-be05-8fdba83559c5', title: 'My title' },
        {
          id: 'fbc99af4-429d-49fd-be05-8fdba83559c5',
          title: 'My updated title',
        },
      ),
      new NodeUpdate(
        Article,
        myContext,
        {
          id: 'fbc99af4-429d-49fd-be05-8fdba83559c5',
          title: 'My updated title',
        },
        { id: 'fbc99af4-429d-49fd-be05-8fdba83559c5', title: 'My title' },
      ),
      new NodeUpdate(
        Tag,
        myContext,
        {
          id: 5,
          title: 'My fifth tag',
        },
        {
          id: 5,
          title: 'My updated fifth tag',
        },
      ),
      new NodeDeletion(Tag, myContext, {
        id: 10,
        title: 'My tenth tag',
      }),
    ]);

    assert.deepStrictEqual(aggregate.summary.toJSON(), {
      creations: ['Article', 'Tag', 'ArticleTag'],
      deletions: ['Tag'],
      updatesByNode: { Tag: ['title'] },
      changes: ['Article', 'Tag', 'ArticleTag'],
    });

    assert.strictEqual(aggregate.size, 5);

    assert.deepStrictEqual(Array.from(aggregate, String), [
      'Article/"2e9b5020-b9fe-4dab-bb59-59c986fffc12"/creation',
      'Tag/1/creation',
      'Tag/5/update',
      'Tag/10/deletion',
      'ArticleTag/{"article":{"id":"2e9b5020-b9fe-4dab-bb59-59c986fffc12"},"tag":{"id":1}}/creation',
    ]);
  });
});
