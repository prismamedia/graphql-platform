import { beforeAll, describe, expect, it } from '@jest/globals';
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

  beforeAll(() => {
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

    expect(() => new NodeCreation(Article, myContext, {})).toThrow(
      '/Article - 2 errors:',
    );
    expect(() => new NodeCreation(Tag, myContext, {})).toThrow(
      '/Tag - 2 errors:',
    );
    expect(() => new NodeCreation(ArticleTag, myContext, {})).toThrow(
      '/ArticleTag - 3 errors:',
    );
  });

  it('aggregates changes', () => {
    const Article = gp.getNodeByName('Article');
    const Tag = gp.getNodeByName('Tag');
    const ArticleTag = gp.getNodeByName('ArticleTag');

    const aggregate = new NodeChangeAggregation([
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

    expect(aggregate.size).toBe(5);

    expect(
      Array.from(aggregate.changesByNode.keys(), ({ name }) => name),
    ).toEqual(['Article', 'Tag', 'ArticleTag']);

    expect(aggregate.summary.creations?.size).toBe(3);
    expect(
      Array.from(aggregate.summary.creations!, ({ name }) => name),
    ).toEqual(['Article', 'Tag', 'ArticleTag']);

    expect(aggregate.summary.deletions?.size).toBe(1);
    expect(
      Array.from(aggregate.summary.deletions!, ({ name }) => name),
    ).toEqual(['Tag']);

    expect(aggregate.summary.updatesByNode?.size).toBe(1);
    expect(
      Array.from(aggregate.summary.updatesByNode!.keys(), ({ name }) => name),
    ).toEqual(['Tag']);

    expect(Array.from(aggregate, String)).toMatchInlineSnapshot(`
      [
        "Article/"2e9b5020-b9fe-4dab-bb59-59c986fffc12"/creation",
        "Tag/1/creation",
        "Tag/5/update",
        "Tag/10/deletion",
        "ArticleTag/{"article":{"id":"2e9b5020-b9fe-4dab-bb59-59c986fffc12"},"tag":{"id":1}}/creation",
      ]
    `);
  });
});
