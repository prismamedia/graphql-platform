import { addPath } from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { GraphQLPlatform } from '../../../index.js';
import {
  myAdminContext,
  MyGP,
  myVisitorContext,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { OperationContext } from '../../operation/context.js';
import { NodeOutputType } from './node.js';

describe(`NodeOutputType`, () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has an output type', (nodeName) => {
      const node = gp.getNode(nodeName);

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
          "Expects an \"Article\"'s field, got: 'unknownField'",
        ],
        [
          'Article',
          `{ category { unknownDeepField } }`,
          myAdminContext,
          '"Article.category" - Expects a "Category"\'s field, got: \'unknownDeepField\'',
        ],
        [
          'Article',
          `{ id(first: 5) }`,
          myAdminContext,
          '"Article.id" - Expects no arguments',
        ],
        [
          'Article',
          `{ id { id } }`,
          myAdminContext,
          '"Article.id" - Expects no selection-set',
        ],
        [
          'Article',
          `{ tags { tag { title }} }`,
          myAdminContext,
          '"Article.tags.@args.first" - Expects a non-undefined "UnsignedInt"',
        ],
        [
          'Article',
          `{ category }`,
          myAdminContext,
          '"Article.category" - Expects a "Category"\'s selection',
        ],
        [
          'Article',
          `{ title tags(first: 5) { tag { title } } }`,
          myVisitorContext,
          '"Article.tags" - Unauthorized access to "ArticleTag"',
        ],
      ])(
        '%p.select(%p) throws the error %p',
        (nodeName, input, requestContext, error) => {
          const node = gp.getNode(nodeName);
          const outputType = node.outputType;

          expect(() =>
            outputType.select(
              // @ts-expect-error
              input,
              new OperationContext(gp, requestContext),
              undefined,
              addPath(undefined, node.name),
            ),
          ).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it.each<[nodeName: string, fragment: string, selection: string]>([
        [
          'Article',
          `{ id }`,
          `{
  id
}`,
        ],
        [
          'Article',
          `... { id }`,
          `{
  id
}`,
        ],
        [
          'Article',
          `... on Article { id }`,
          `{
  id
}`,
        ],
        [
          'Article',
          `fragment MyTestFragment on Article { id }`,
          `{
  id
}`,
        ],
        [
          'Article',
          `{ id lowerCasedTitle category { id _a: parent { _id } } }`,
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
            createdArticles(where: { status: published }, orderBy: [updatedAt_DESC], first: 10) {
              _id
              id
            }
            createdArticleCount(where: { status: published })
          }`,
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
      ])('%p.select(%p) = %p', (nodeName, fragment, selectionSet) => {
        const node = gp.getNode(nodeName);
        const outputType = node.outputType;

        expect(
          graphql.print(outputType.select(fragment).toGraphQLSelectionSet()),
        ).toEqual(selectionSet);
      });
    });
  });
});
