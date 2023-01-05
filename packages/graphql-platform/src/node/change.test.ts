import {
  GraphQLPlatform,
  NodeChangeAggregation,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../index.js';

describe('Change', () => {
  let gp: GraphQLPlatform;

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

    expect(() => new NodeCreation(Article, {}, {})).toThrowError(
      '/Article - 2 errors:',
    );
    expect(() => new NodeCreation(Tag, {}, {})).toThrowError(
      '/Tag - 2 errors:',
    );
    expect(() => new NodeCreation(ArticleTag, {}, {})).toThrowError(
      '/ArticleTag - 3 errors:',
    );
  });

  it('aggregates changes', () => {
    const Article = gp.getNodeByName('Article');
    const Tag = gp.getNodeByName('Tag');
    const ArticleTag = gp.getNodeByName('ArticleTag');

    const aggregate = new NodeChangeAggregation([
      // These 2 changes are aggregated
      new NodeCreation(
        Article,
        {},
        { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12', title: 'My title' },
      ),
      new NodeUpdate(
        Article,
        {},
        { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12', title: 'My title' },
        { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12', title: 'My new title' },
      ),
      // These 2 changes are removed
      new NodeCreation(
        Article,
        {},
        {
          id: 'a642c6e3-e477-45da-bd0d-0351a2b086a0',
          title: 'My other title',
        },
      ),
      new NodeDeletion(
        Article,
        {},
        {
          id: 'a642c6e3-e477-45da-bd0d-0351a2b086a0',
          title: 'My other title',
        },
      ),
      new NodeCreation(
        Tag,
        {},
        {
          id: 1,
          title: 'My first tag',
        },
      ),
      // These 2 changes are aggregated
      new NodeCreation(
        ArticleTag,
        {},
        {
          article: { id: '2e9b5020-b9fe-4dab-bb59-59c986fffc12' },
          tag: { id: 1 },
          order: 1,
        },
      ),
      new NodeUpdate(
        ArticleTag,
        {},
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
        {},
        { id: 'fbc99af4-429d-49fd-be05-8fdba83559c5', title: 'My title' },
        {
          id: 'fbc99af4-429d-49fd-be05-8fdba83559c5',
          title: 'My updated title',
        },
      ),
      new NodeUpdate(
        Article,
        {},
        {
          id: 'fbc99af4-429d-49fd-be05-8fdba83559c5',
          title: 'My updated title',
        },
        { id: 'fbc99af4-429d-49fd-be05-8fdba83559c5', title: 'My title' },
      ),
    ]);

    expect(aggregate.length).toBe(3);

    expect(
      Array.from(aggregate, (change) => ({
        node: change.node.name,
        flattenedId: change.flattenedId,
        kind: change.kind,
      })),
    ).toEqual([
      {
        node: 'Article',
        flattenedId: '2e9b5020-b9fe-4dab-bb59-59c986fffc12',
        kind: 'creation',
      },
      {
        node: 'Tag',
        flattenedId: '1',
        kind: 'creation',
      },
      {
        node: 'ArticleTag',
        flattenedId: '2e9b5020-b9fe-4dab-bb59-59c986fffc12:1',
        kind: 'creation',
      },
    ]);
  });
});
