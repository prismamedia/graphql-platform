import {
  GraphQLPlatform,
  OperationContext,
} from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  myVisitorContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { format } from '@sqltools/formatter';
import { EOL } from 'node:os';
import { after, before, describe, it } from 'node:test';
import { createMyConnector } from '../../__tests__/config.js';
import { MariaDBConnector } from '../../index.js';
import { SelectStatement } from './select.js';

describe('Select statement', () => {
  const gp = new GraphQLPlatform<MyContext, MariaDBConnector>({
    nodes: {
      Article: {
        authorization: ({ user }) =>
          user?.role === 'ADMIN'
            ? undefined
            : { category: { brand: { title_in: ['brand1', 'brand2'] } } },
        components: {
          id: { type: 'UUIDv4', nullable: false, mutable: false },
          title: { type: 'NonEmptyString' },
          category: { kind: 'Edge', head: 'Category' },
        },
        uniques: [['id']],
        reverseEdges: {
          tags: { originalEdge: 'ArticleTag' },
        },
      },
      Category: {
        authorization: ({ user }) =>
          user?.role === 'ADMIN'
            ? undefined
            : {
                OR: [
                  { brand: { title_in: ['brand1', 'brand2'] } },
                  {
                    articles_some: {
                      id: '86e13902-a8c7-444b-aa7d-68ea8bffc314',
                    },
                  },
                ],
              },
        components: {
          brand: {
            kind: 'Edge',
            head: 'Brand',
            nullable: false,
            mutable: false,
          },
          id: { type: 'UUIDv4', nullable: false, mutable: false },
          title: { type: 'NonEmptyString' },
        },
        uniques: [['id']],
        reverseEdges: {
          articles: { originalEdge: 'Article' },
        },
      },
      Brand: {
        authorization: ({ user }) =>
          user?.role === 'ADMIN'
            ? undefined
            : { title_in: ['brand1', 'brand2'] },
        components: {
          id: { type: 'UUIDv4', nullable: false, mutable: false },
          title: { type: 'NonEmptyString' },
        },
        uniques: [['id']],
        reverseEdges: {
          categories: { originalEdge: 'Category' },
        },
      },
      Tag: {
        authorization: ({ user }) =>
          user?.role === 'ADMIN'
            ? undefined
            : {
                articles_some: {
                  article: {
                    OR: [
                      { id: '6b818de6-b549-4ab1-b95e-9436993e8a0e' },
                      { category: null },
                      { tagCount_gt: 0 },
                    ],
                  },
                },
              },
        components: {
          id: { type: 'UUIDv4', nullable: false, mutable: false },
          title: { type: 'NonEmptyString' },
        },
        uniques: [['id']],
        reverseEdges: {
          articles: { originalEdge: 'ArticleTag' },
        },
      },
      ArticleTag: {
        authorization: ({ user }) =>
          user?.role === 'ADMIN'
            ? undefined
            : { article: { id: 'c96be474-23fa-452d-97b3-094c226c4675' } },
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
        },
        uniques: [['article', 'tag']],
        mutation: { update: false },
      },
    },

    connector: (gp, configPath) =>
      createMyConnector(
        'tests_connector_mariadb_select_statement',
        gp,
        configPath,
      ),
  });

  before(() => gp.connector.setup());
  after(() => gp.connector.teardown());

  (
    [myVisitorContext, myAdminContext] satisfies ReadonlyArray<MyContext>
  ).forEach((requestContext) => {
    it(`works`, async ({ assert: { snapshot, doesNotReject } }) => {
      const ArticleNode = gp.getNodeByName('Article');

      const statement = new SelectStatement(
        gp.connector.schema.getTableByNode(ArticleNode),
        new OperationContext(gp, requestContext),
        {
          select: ArticleNode.outputType.select(`{
            id
            title
            category {
              brand {
                id
                title
              }
              id
              title
            }
            tags(first: 10) {
              tag {
                id
                title
              }
            }
          }`),
        },
      );

      snapshot(format(statement.sql).split(EOL));

      await doesNotReject(() => gp.connector.executeStatement(statement));
    });
  });
});
