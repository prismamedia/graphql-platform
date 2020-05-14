import { config, MyGP } from '../../__tests__/gp';
import { ArticleFormat } from '../../__tests__/resources/Article';
import { NodeValue, Resource, SerializedNodeValue } from '../resource';

describe('Resource', () => {
  const RealDate = Date;

  function mockDate(reference: string) {
    (global as any).Date = class extends RealDate {
      constructor(date: any) {
        super(date || reference);
      }
    };
  }

  afterEach(() => {
    global.Date = RealDate;
  });

  let gp: MyGP;
  let article: Resource;

  const normalizedNode: NodeValue = {
    _id: 5,
    id: '721f56fd-d639-49ee-a5e5-b81d529be4cb',
    title: 'Title',
    slug: 'title',
    body: 'The body',
    format: ArticleFormat.Rich,
    publishedAt: new Date('2019-02-01T00:00:00.000Z'),
    publicationDay: new Date('2019-02-01T00:00:00.000Z'),
    publicationTime: new Date('2019-02-01T00:00:00.000Z'),
    isPublished: true,
    isImportant: false,
    category: {
      parent: {
        id: 'my-parent-s-category-id',
      },
      slug: 'my-category-slug',
    },
    author: {
      username: 'my-author-username',
    },
    moderator: null,
    updatedAt: new Date('2019-01-01T00:00:00.000Z'),
    createdAt: new Date('2019-01-01T00:00:00.000Z'),
  };

  const normalizedSerializedNode: SerializedNodeValue = {
    _id: 5,
    id: '721f56fd-d639-49ee-a5e5-b81d529be4cb',
    title: 'Title',
    slug: 'title',
    body: 'The body',
    format: 'Rich',
    publishedAt: '2019-02-01T00:00:00.000Z',
    publicationDay: '2019-02-01',
    publicationTime: '00:00:00.000Z',
    isPublished: true,
    isImportant: false,
    category: {
      parent: {
        id: 'my-parent-s-category-id',
      },
      slug: 'my-category-slug',
    },
    author: {
      username: 'my-author-username',
    },
    moderator: null,
    updatedAt: '2019-01-01T00:00:00.000Z',
    createdAt: '2019-01-01T00:00:00.000Z',
  };

  const node: NodeValue = {
    ...normalizedNode,
    author: {
      id: '94ace2ac-531e-4f02-a658-5eb9180d5bcd',
    },
  };

  const serializedNode: SerializedNodeValue = {
    ...normalizedSerializedNode,
    author: {
      id: '94ace2ac-531e-4f02-a658-5eb9180d5bcd',
    },
  };

  beforeAll(() => {
    gp = new MyGP(config);
    article = gp.getResourceMap().assert('Article');
  });

  it('throws an error on invalid value', () => {
    expect(() => article.assertValue(null)).toThrowError(
      'The "Article"\'s node value is invalid: a plain object is expected but received "null" instead.',
    );
    expect(() => article.assertValue(true)).toThrowError(
      'The "Article"\'s node value is invalid: a plain object is expected but received "true" instead.',
    );
    expect(() => article.assertValue('a string')).toThrowError(
      'The "Article"\'s node value is invalid: a plain object is expected but received "a string" instead.',
    );
  });

  it("validates a full node's value", () => {
    expect(article.assertValue(normalizedNode)).toEqual(normalizedNode);
    expect(article.assertValue(normalizedNode, false)).toEqual(normalizedNode);
    expect(article.assertValue(normalizedNode, true)).toEqual(normalizedNode);
    expect(
      article.assertValue(normalizedNode, true, article.getComponentSet()),
    ).toEqual(normalizedNode);

    expect(article.assertValue(node)).toEqual(node);
    expect(article.assertValue(node, false)).toEqual(node);
    expect(() => article.assertValue(node, true)).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
    expect(() =>
      article.assertValue(node, true, article.getComponentSet()),
    ).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
  });

  it("validates a partial node's value", () => {
    // Omit the "title" property of the node
    const { title: normalizedTitle, ...partialNormalizedNode } = normalizedNode;

    expect(article.assertValue(partialNormalizedNode)).toEqual(
      partialNormalizedNode,
    );
    expect(article.assertValue(partialNormalizedNode, false)).toEqual(
      partialNormalizedNode,
    );
    expect(article.assertValue(partialNormalizedNode, true)).toEqual(
      partialNormalizedNode,
    );
    expect(() =>
      article.assertValue(
        partialNormalizedNode,
        true,
        article.getComponentSet(),
      ),
    ).toThrowError(
      'The "Article.title"\'s value is invalid: cannot be undefined.',
    );

    // Omit the "title" property of the node
    const { title, ...partialNode } = node;

    expect(article.assertValue(partialNode)).toEqual(partialNode);
    expect(article.assertValue(partialNode, false)).toEqual(partialNode);
    expect(() => article.assertValue(partialNode, true)).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
    expect(() =>
      article.assertValue(partialNode, true, article.getComponentSet()),
    ).toThrowError(
      'The "Article.title"\'s value is invalid: cannot be undefined.',
    );
  });

  it("serializes a full node's value", () => {
    expect(article.serializeValue(normalizedNode)).toEqual(
      normalizedSerializedNode,
    );
    expect(article.serializeValue(normalizedNode, false)).toEqual(
      normalizedSerializedNode,
    );
    expect(
      article.serializeValue(normalizedNode, true, article.getComponentSet()),
    ).toEqual(normalizedSerializedNode);

    expect(article.serializeValue(node)).toEqual(serializedNode);
    expect(article.serializeValue(node, false)).toEqual(serializedNode);
    expect(() =>
      article.serializeValue(node, true, article.getComponentSet()),
    ).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
  });

  it("serializes a partial node's value", () => {
    // Omit the "title" property of the node & serializedNode
    const { title: normalizedTitle, ...partialNormalizedNode } = normalizedNode;
    const {
      title: normalizedSerializedTitle,
      ...partialNormalizedSerializedNode
    } = normalizedSerializedNode;

    expect(article.serializeValue(partialNormalizedNode)).toEqual(
      partialNormalizedSerializedNode,
    );
    expect(article.serializeValue(partialNormalizedNode, false)).toEqual(
      partialNormalizedSerializedNode,
    );
    expect(article.serializeValue(partialNormalizedNode, true)).toEqual(
      partialNormalizedSerializedNode,
    );
    expect(() =>
      article.serializeValue(
        partialNormalizedNode,
        true,
        article.getComponentSet(),
      ),
    ).toThrowError(
      'The "Article.title"\'s value is invalid: cannot be undefined.',
    );

    // Omit the "title" property of the node & serializedNode
    const { title, ...partialNode } = node;
    const { title: serializedTitle, ...partialSerializedNode } = serializedNode;

    expect(article.serializeValue(partialNode)).toEqual(partialSerializedNode);
    expect(article.serializeValue(partialNode, false)).toEqual(
      partialSerializedNode,
    );
    expect(() => article.serializeValue(partialNode, true)).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
  });

  it("parses a full node's value", () => {
    // We mock the "new Date()" to have a consistent "date" part for our "time" fields
    mockDate('2019-02-01T12:00:00.000Z');

    expect(article.parseValue(normalizedSerializedNode)).toEqual(
      normalizedNode,
    );
    expect(article.parseValue(normalizedSerializedNode, false)).toEqual(
      normalizedNode,
    );
    expect(article.parseValue(normalizedSerializedNode, true)).toEqual(
      normalizedNode,
    );
    expect(
      article.parseValue(
        normalizedSerializedNode,
        true,
        article.getComponentSet(),
      ),
    ).toEqual(normalizedNode);

    expect(article.parseValue(serializedNode)).toEqual(node);
    expect(article.parseValue(serializedNode, false)).toEqual(node);
    expect(() => article.parseValue(serializedNode, true)).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
  });

  it("parses a partial node's value", () => {
    // Omit the "title" property of the normalized node & serializedNode
    const { title: normalizedTitle, ...partialNormalizedNode } = normalizedNode;
    const {
      title: normalizedSerializedTitle,
      ...partialNormalizedSerializedNode
    } = normalizedSerializedNode;

    // We mock the "new Date()" to have a consistent "date" part for our "time" fields
    mockDate('2019-02-01T12:00:00.000Z');

    expect(article.parseValue(partialNormalizedSerializedNode)).toEqual(
      partialNormalizedNode,
    );
    expect(article.parseValue(partialNormalizedSerializedNode, false)).toEqual(
      partialNormalizedNode,
    );
    expect(article.parseValue(partialNormalizedSerializedNode, true)).toEqual(
      partialNormalizedNode,
    );
    expect(() =>
      article.parseValue(
        partialNormalizedSerializedNode,
        true,
        article.getComponentSet(),
      ),
    ).toThrowError(
      'The "Article.title"\'s value is invalid: cannot be undefined.',
    );

    // Omit the "title" property of the node & serializedNode
    const { title, ...partialNode } = node;
    const { title: serializedTitle, ...partialSerializedNode } = serializedNode;

    expect(article.parseValue(partialSerializedNode)).toEqual(partialNode);
    expect(article.parseValue(partialSerializedNode, false)).toEqual(
      partialNode,
    );
    expect(() => article.parseValue(partialSerializedNode, true)).toThrowError(
      'The "User.username"\'s value is invalid: cannot be undefined.',
    );
  });
});
