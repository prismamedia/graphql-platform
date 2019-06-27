import { BoundOff } from '@prismamedia/ts-async-event-emitter';
import { Connection, format } from 'mysql';
import { format as beautify } from 'sql-formatter';
import complexMultiMutationRequest from '../../../graphql-platform-core/src/__tests__/execution/complex-multi-mutation';
import complexMultiQueryRequest from '../../../graphql-platform-core/src/__tests__/execution/complex-multi-query';
import { Connector, ConnectorEventKind, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Execution', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  let connectionSet = new Set<Connection['threadId']>();
  let queries: string[] = [];
  let offListeners: BoundOff[];

  beforeAll(async done => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();

    done();
  });

  beforeEach(async done => {
    offListeners = connector.onConfig({
      [ConnectorEventKind.StartTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('START TRANSACTION;');
      },
      [ConnectorEventKind.CommitTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('COMMIT;');
      },
      [ConnectorEventKind.RollbackTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('ROLLBACK;');
      },
      [ConnectorEventKind.PreQuery]: ({ threadId, sql, values }) => {
        connectionSet.add(threadId);
        queries.push(beautify(format(sql, values)));
      },
    });

    done();
  });

  afterEach(async done => {
    offListeners && offListeners.map(off => off());
    connectionSet.clear();
    queries.length = 0;

    await database.truncate();

    done();
  });

  afterAll(async () => database.drop());

  it('executes a complex multi query request', async done => {
    const { data, errors } = await gp.execute(complexMultiQueryRequest);

    if (errors) {
      console.error(
        errors.map(error => ({
          path: error.path,
          originalError: error.originalError,
        })),
      );
    }

    expect(errors).toBeUndefined();

    expect(data).toEqual({
      articleCount: 0,
      article_00: null,
      article_01: null,
      article_02: null,
      article_03: null,
      article_04: null,
      article_05: null,
      articles: [],
    });

    expect(
      [`# ${queries.length} queries in ${connectionSet.size} connections`, ...queries].join('\n\n'),
    ).toMatchSnapshot();

    done();
  });

  it('executes a complex multi mutation request', async done => {
    const { data, errors } = await gp.execute(complexMultiMutationRequest);

    if (errors) {
      console.error(
        errors.map(error => ({
          path: error.path,
          originalError: error.originalError,
        })),
      );
    }

    expect(errors).toBeUndefined();

    expect(data).toEqual({
      article_01: {
        author: {
          username: 'user-01',
        },
        moderator: null,
        category: {
          parent: {
            id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
          },
          slug: 'second-category',
        },
        id: '9b6b98fa-586d-4987-82a0-d63f11bbe560',
        slug: 'my-first-article-title-rich-authored-by-user-01-in-the-second-category',
        tagCount: 0,
        tags: [],
      },
      article_02: {
        author: {
          username: 'a-new-user-created-in-the-nested-mutation',
        },
        moderator: {
          username: 'user-01',
        },
        category: {
          parent: {
            id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
          },
          slug: 'first-category',
        },
        id: 'e672258b-0870-437b-b440-e62848b4f666',
        slug: 'my-second-article-title-video-authored-by-user-01-in-the-first-category',
        lowerCasedTitle:
          'LowerCasedTitle: "my second article title, video, authored by user-01, in the first category." in category "{"parent":{"id":"92dc645e-c5ee-46ac-8a24-53b1584e4c99"},"slug":"first-category"}"',
        tagCount: 0,
        tags: [],
      },
      category_00: {
        id: '92dc645e-c5ee-46ac-8a24-53b1584e4c99',
        slug: 'root-category',
      },
      category_01: {
        id: '8fdec553-453e-442f-a710-c52ee4a23080',
        slug: 'first-category',
      },
      category_02: {
        id: 'e411a5dc-a14f-4d0d-ac54-d4c93c7c5b84',
        slug: 'second-category',
      },
      category_03_to_be_deleted: {
        id: 'da8d3a79-6161-46cd-a9fa-ae1382428d3c',
        slug: 'third-category-to-be-deleted',
      },
      deleted_category_03: {
        title: 'Third category, to be deleted',
      },
      tag_01: {
        id: '7636d577-397f-430c-8bed-bfe0d765af07',
        slug: 'first-tag',
      },
      tag_02: {
        id: '21b31331-c5cc-4426-b648-4b0f14232866',
        slug: 'second-tag',
      },
      tag_03: {
        id: '810629d2-3391-480e-ba9a-5e77999f6c72',
        slug: 'third-tag',
      },
      tag_04: {
        id: '6af9c25e-2072-468f-8190-3c205165fe38',
        slug: 'fourth-tag',
      },
      user_01: {
        id: '771ad98a-5b88-4d1d-a3f3-9133d367b708',
        username: 'user-01',
      },
      article_tag_01: {
        article: {
          title: 'My first article title, RICH, authored by user-01, in the second category.',
          tagCount: 1,
        },
        tag: {
          title: 'First tag',
          articleCount: 1,
        },
        comment: null,
      },
      article_tag_02: {
        article: {
          title: 'My second article title, VIDEO, authored by user-01, in the first category.',
          tagCount: 1,
        },
        tag: {
          title: 'Second tag',
          articleCount: 1,
        },
        comment: null,
      },
      article_tag_03: {
        article: {
          title: 'My second article title, VIDEO, authored by user-01, in the first category.',
          tagCount: 2,
        },
        tag: {
          title: 'Third tag',
          articleCount: 1,
        },
      },
      article_tag_04: {
        article: {
          title: 'My second article title, VIDEO, authored by user-01, in the first category.',
          tagCount: 3,
        },
        tag: {
          title: 'Fourth tag',
          articleCount: 1,
        },
      },
      article_tag_05: {
        article: {
          title: 'My second article title, VIDEO, authored by user-01, in the first category.',
          tagCount: 4,
        },
        tag: {
          title: 'First tag',
          articleCount: 2,
        },
      },
      not_updated_article_01: {
        title: 'My first article title, RICH, authored by user-01, in the second category.',
        body: null,
      },
      updated_article_01: {
        title: "My new first article's title",
        body: "My new first article's body",
      },
      updated_article_02: {
        moderator: null,
      },
      article_tag_comment_01: {
        articleTag: {
          article: {
            id: '9b6b98fa-586d-4987-82a0-d63f11bbe560',
          },
          tag: {
            id: '7636d577-397f-430c-8bed-bfe0d765af07',
          },
        },
        body: 'My first article tag comment, on first article & first tag',
      },
    });

    expect(
      [`# ${queries.length} queries in ${connectionSet.size} connections`, , ...queries].join('\n\n'),
    ).toMatchSnapshot();

    done();
  });
});
