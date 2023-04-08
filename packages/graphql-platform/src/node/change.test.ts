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

    expect(() => new NodeCreation(Article, myContext, {})).toThrowError(
      '/Article - 2 errors:',
    );
    expect(() => new NodeCreation(Tag, myContext, {})).toThrowError(
      '/Tag - 2 errors:',
    );
    expect(() => new NodeCreation(ArticleTag, myContext, {})).toThrowError(
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
    ]);

    expect(aggregate.requestContexts.length).toBe(1);
    expect(aggregate.length).toBe(3);

    expect(
      Object.fromEntries(
        Array.from(aggregate.flatChanges, ([node, components]) => [
          node.name,
          Array.from(components).map((component) => component.name),
        ]),
      ),
    ).toEqual({
      Article: ['id', 'title'],
      ArticleTag: ['article', 'tag', 'order'],
      Tag: ['id', 'title'],
    });

    expect(
      Array.from(aggregate, (change) => ({
        node: change.node.name,
        stringifiedId: change.stringifiedId,
        kind: change.kind,
      })),
    ).toEqual([
      {
        node: 'Article',
        stringifiedId: '{"id":"2e9b5020-b9fe-4dab-bb59-59c986fffc12"}',
        kind: 'creation',
      },
      {
        node: 'Tag',
        stringifiedId: '{"id":1}',
        kind: 'creation',
      },
      {
        node: 'ArticleTag',
        stringifiedId:
          '{"article":{"id":"2e9b5020-b9fe-4dab-bb59-59c986fffc12"},"tag":{"id":1}}',
        kind: 'creation',
      },
    ]);
  });
});
