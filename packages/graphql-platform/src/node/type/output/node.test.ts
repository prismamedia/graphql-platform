import { beforeAll, describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import {
  ArticleStatus,
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

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has an output type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const nodeOutputType = node.outputType;
      expect(nodeOutputType).toBeInstanceOf(NodeOutputType);

      if (node.isPublic()) {
        expect(nodeOutputType.getGraphQLObjectType()).toBeInstanceOf(
          graphql.GraphQLObjectType,
        );
        expect(
          graphql.printType(nodeOutputType.getGraphQLObjectType()),
        ).toMatchSnapshot();
      } else {
        expect(() => nodeOutputType.getGraphQLObjectType()).toThrowError(
          `The "${nodeName}" node is private`,
        );
      }
    });

    it('throws an Error on duplicate field name', () => {
      expect(
        () =>
          new GraphQLPlatform({
            nodes: {
              ...nodes,
              User: {
                ...nodes.User,
                output: {
                  virtualFields: {
                    username: {
                      args: {},
                      type: new graphql.GraphQLNonNull(graphql.GraphQLString),
                      resolve: () => 'MyUsername',
                    },
                  },
                },
              },
            },
          }),
      ).toThrowError();
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
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
          'Expects an "Article"\'s field among "_id, id, status, title, slug, body, category, createdBy, createdAt, updatedBy, updatedAt, metas, highlighted, sponsored, views, score, machineTags, tags, tagCount, extension, lowerCasedTitle, upperCasedTitle", got: \'unknownField\'',
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
          '/tags/@args/first - Expects a non-undefined "UnsignedInt"',
        ],
        [
          'Article',
          `{ category }`,
          myAdminContext,
          '/category - Expects a "Category"\'s selection',
        ],
      ])(
        '%p.select(%p) throws the error %p',
        (nodeName, input, requestContext, error) => {
          const node = gp.getNodeByName(nodeName);
          const outputType = node.outputType;

          expect(() =>
            outputType.select(
              // @ts-expect-error
              input,
              new OperationContext(gp, requestContext),
            ),
          ).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it.each<
        [
          nodeName: string,
          fragment: string,
          context: GraphQLSelectionContext | undefined,
          selection: string,
        ]
      >([
        [
          'Article',
          `{ id }`,
          undefined,
          `{
  id
}`,
        ],
        [
          'Article',
          `... { id }`,
          undefined,
          `{
  id
}`,
        ],
        [
          'Article',
          `... on Article { id }`,
          undefined,
          `{
  id
}`,
        ],
        [
          'Article',
          `fragment MyTestFragment on Article { id }`,
          undefined,
          `{
  id
}`,
        ],
        [
          'Article',
          `{ id __typename lowerCasedTitle category { id _a: parent { _id } } }`,
          undefined,
          `{
  id
  status
  title
  category {
    title
    id
    parent {
      _id
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
          `{
  username
  profile {
    birthday
    twitterHandle
    facebookId
  }
  createdArticles(first: 10) {
    _id
    id
  }
  createdArticleCount
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
            createdArticles(where: $filter, orderBy: [updatedAt_DESC], first: 10) {
              _id
              id
            }
            createdArticleCount(where: $filter)
          }`,
          { variableValues: { filter: { status: ArticleStatus.PUBLISHED } } },
          `{
  username
  profile {
    birthday
    twitterHandle
    facebookId
  }
  createdArticles(first: 10) {
    _id
    id
  }
  createdArticleCount
}`,
        ],
      ])('%p.select(%p) = %p', (nodeName, fragment, context, selectionSet) => {
        const node = gp.getNodeByName(nodeName);
        const outputType = node.outputType;

        expect(
          graphql.print(
            outputType
              .select(fragment, undefined, context)
              .toGraphQLSelectionSet(),
          ),
        ).toEqual(selectionSet);
      });
    });
  });
});
