import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  ArticleStatus,
  MyContext,
  MyGP,
  myAdminContext,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
import { OperationContext } from '../../operation/context.js';
import { GraphQLSelectionContext, NodeOutputType } from './node.js';

describe(`NodeOutputType`, () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} has an output type`, ({ assert: { snapshot } }) => {
        const node = gp.getNodeByName(nodeName);

        const nodeOutputType = node.outputType;
        assert(nodeOutputType instanceof NodeOutputType);

        if (node.isPublic()) {
          assert(
            nodeOutputType.getGraphQLObjectType() instanceof
              graphql.GraphQLObjectType,
          );
          snapshot(graphql.printType(nodeOutputType.getGraphQLObjectType()));
        } else {
          assert.throws(() => nodeOutputType.getGraphQLObjectType(), {
            message: `The "${nodeName}" node is private`,
          });
        }
      });
    });

    it('throws an error on duplicate field name', () => {
      assert.throws(
        () =>
          new GraphQLPlatform({
            nodes: {
              ...nodes,
              User: {
                ...nodes.User,
                output: {
                  virtualFields: {
                    username: {
                      type: new graphql.GraphQLNonNull(graphql.GraphQLString),
                      resolve: () => 'MyUsername',
                    },
                  },
                },
              },
            },
          }),
        {
          message:
            '/GraphQLPlatformConfig/nodes/User/output/virtualFields/username - At least 1 field already have this name',
        },
      );
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      (
        [
          [
            'Article',
            undefined,
            myAdminContext,
            'Expects an "Article"\'s selection, got: undefined',
          ],
          [
            'Article',
            null,
            myAdminContext,
            'Expects an "Article"\'s selection, got: null',
          ],
          [
            'Article',
            `{ unknownField }`,
            myAdminContext,
            'Expects an "Article"\'s field among "_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas, highlighted, sponsored, views, score, machineTags, tags, tagCount, extension, lowerCasedTitle, upperCasedTitle, mixedCasedTitle, similars", got: \'unknownField\'',
          ],
          [
            'Article',
            `{ category { unknownDeepField } }`,
            myAdminContext,
            '/category - Expects a "Category"\'s field among "_id, id, title, slug, parent, order, children, childCount, articles, articleCount", got: \'unknownDeepField\'',
          ],
          [
            'Article',
            `{ id(first: 5) }`,
            myAdminContext,
            '/id - Expects no arguments',
          ],
          [
            'Article',
            `{ id { id } }`,
            myAdminContext,
            '/id - Expects no selection-set',
          ],
          [
            'Article',
            `{ tags { tag { title }} }`,
            myAdminContext,
            '/tags/@args/first - Expects a non-undefined "UnsignedInt", got: undefined',
          ],
          [
            'Article',
            `{ category }`,
            myAdminContext,
            '/category - Expects a "Category"\'s selection-set',
          ],
        ] as const
      ).forEach(([nodeName, input, requestContext, error]) => {
        it(`${nodeName}.select(${input}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);
          const outputType = node.outputType;

          assert.throws(
            () =>
              outputType.select(
                // @ts-expect-error
                input,
                new OperationContext(gp, requestContext),
              ),
            { message: error },
          );
        });
      });
    });

    describe('Works', () => {
      (
        [
          [
            'Article',
            `{ id }`,
            undefined,
            undefined,
            `{
  id
}`,
          ],
          [
            'Article',
            `... { id }`,
            undefined,
            undefined,
            `{
  id
}`,
          ],
          [
            'Article',
            `... on Article { id }`,
            undefined,
            undefined,
            `{
  id
}`,
          ],
          [
            'Article',
            `fragment MyTestFragment on Article { id }`,
            undefined,
            undefined,
            `{
  id
}`,
          ],
          [
            'Article',
            `{
            id
            lowerCasedTitle(prefix: "test_")
            category { id _a: parent { _id } }
            similars(first: 5) { 
              title
              similars(first: 10) {
                slug
              }
            }
          }`,
            undefined,
            undefined,
            `{
  id
  lowerCasedTitle(prefix: "test_")
  category {
    id
    _a: parent {
      _id
    }
  }
  similars(first: 5) {
    title
    similars(first: 10) {
      slug
    }
  }
}`,
          ],
          [
            'User',
            `{
            username
            profile {
              birthday
              twitterHandle
            }
            ... {
              profile {
                facebookId
                birthday
              }
            }
            createdArticles(where: { status: PUBLISHED }, orderBy: [updatedAt_DESC], first: 10) {
              _id
              id
            }
            createdArticleCount(where: { status: PUBLISHED })
          }`,
            undefined,
            undefined,
            `{
  username
  profile {
    birthday
    twitterHandle
    facebookId
  }
  createdArticles(
    where: {status: PUBLISHED}
    orderBy: [updatedAt_DESC]
    first: 10
  ) {
    _id
    id
  }
  createdArticleCount(where: {status: PUBLISHED})
}`,
          ],
          [
            'User',
            `{
            username
            profile {
              birthday
              twitterHandle
            }
            ... {
              profile {
                facebookId
                birthday
              }
            }
            createdArticles(where: $filter, orderBy: [updatedAt_DESC], skip: 5, first: 10) {
              _id
              id
            }
            createdArticleCount(where: $filter)
          }`,
            undefined,
            { variableValues: { filter: { status: ArticleStatus.PUBLISHED } } },
            `{
  username
  profile {
    birthday
    twitterHandle
    facebookId
  }
  createdArticles(
    where: {status: PUBLISHED}
    orderBy: [updatedAt_DESC]
    skip: 5
    first: 10
  ) {
    _id
    id
  }
  createdArticleCount(where: {status: PUBLISHED})
}`,
          ],
          [
            'User',
            `{
            username
            profile @skip(if: $skipProfile) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            { variableValues: { skipProfile: true } },
            `{
  username
}`,
          ],
          [
            'User',
            `{
            username
            profile @skip(if: true) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            undefined,
            `{
  username
}`,
          ],
          [
            'User',
            `{
            username
            profile @skip(if: $skipProfile) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            { variableValues: { skipProfile: false } },
            `{
  username
  profile {
    birthday
    twitterHandle
  }
}`,
          ],
          [
            'User',
            `{
            username
            profile @skip(if: false) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            undefined,
            `{
  username
  profile {
    birthday
    twitterHandle
  }
}`,
          ],
          [
            'User',
            `{
            username
            profile @include(if: $includeProfile) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            { variableValues: { includeProfile: true } },
            `{
  username
  profile {
    birthday
    twitterHandle
  }
}`,
          ],
          [
            'User',
            `{
            username
            profile @include(if: true) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            undefined,
            `{
  username
  profile {
    birthday
    twitterHandle
  }
}`,
          ],
          [
            'User',
            `{
            username
            profile @include(if: $includeProfile) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            { variableValues: { includeProfile: false } },
            `{
  username
}`,
          ],
          [
            'User',
            `{
            username
            profile @include(if: false) {
              birthday
              twitterHandle
            }
          }`,
            undefined,
            undefined,
            `{
  username
}`,
          ],
        ] satisfies ReadonlyArray<
          [
            nodeName: string,
            fragment: string,
            requestContext: MyContext | undefined,
            selectionContext: GraphQLSelectionContext | undefined,
            expected: string,
          ]
        >
      ).forEach(
        ([nodeName, fragment, requestContext, selectionContext, expected]) => {
          it(`${nodeName}.select(${fragment})`, () => {
            const node = gp.getNodeByName(nodeName);
            const outputType = node.outputType;

            assert.equal(
              outputType
                .select(
                  fragment,
                  requestContext && new OperationContext(gp, requestContext),
                  selectionContext,
                )
                .toString(),
              expected,
            );
          });
        },
      );
    });
  });
});
