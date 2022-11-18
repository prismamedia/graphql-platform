import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { GraphQLPlatform, NodeCreationStatement } from '../../../index.js';
import {
  ArticleStatus,
  MyGP,
  myUserContext,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { mockConnector } from '../../../__tests__/connector-mock.js';
import { MutationContext } from '../../operation.js';
import { LeafComparisonFilter } from '../../statement/filter.js';
import { NodeCreationInputType } from './creation.js';

describe('NodeCreationInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        find: async ({ node, filter, selection }) => {
          if (
            node.name === 'Category' &&
            filter?.filter.equals(
              new LeafComparisonFilter(
                node.getLeafByName('id'),
                'eq',
                '91a7c846-b030-4ef3-aaaa-747fe7b11519',
              ),
            )
          ) {
            return [{ _id: 4 }];
          } else if (
            node.name === 'User' &&
            filter?.filter.equals(
              new LeafComparisonFilter(
                node.getLeafByName('id'),
                'eq',
                '2059b77a-a735-41fe-b415-5b12944b6ba6',
              ),
            )
          ) {
            return [
              (selection.expressionsByKey.has('id')
                ? { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' }
                : { username: 'yvann' }) as any,
            ];
          }

          throw new Error('KO');
        },
      }),
    });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has a creation input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const creationInputType = node.creationInputType;
      expect(creationInputType).toBeInstanceOf(NodeCreationInputType);

      if (node.isMutationPublic(utils.MutationType.CREATION)) {
        expect(creationInputType.getGraphQLInputType()).toBeInstanceOf(
          graphql.GraphQLInputObjectType,
        );

        expect(
          graphql.printType(creationInputType.getGraphQLInputType()),
        ).toMatchSnapshot(creationInputType.name);
      } else {
        expect(() => creationInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}CreationInput" input type is private`,
        );
      }
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          {},
          '"ArticleCreationInput.title" - Expects a non-undefined "NonEmptyTrimmedString"',
        ],
        [
          'Article',
          {
            title: 'My valid title',
            category: {},
          },
          '"ArticleCreationInput.category" - Expects one and only one action, got: [Object: null prototype] {}',
        ],
        [
          'Article',
          {
            title: 'My valid title',
            category: {
              connect: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
              connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
            },
          },
          '"ArticleCreationInput.category" - Expects one and only one action, got: [Object: null prototype] {',
        ],
      ])(
        '%sCreationInput.parseValue(%p) throws an error',
        (nodeName, value, error) => {
          const node = gp.getNodeByName(nodeName);
          const creationInputType = node.creationInputType;

          expect(() => creationInputType.parseValue(value)).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it('creates a valid statement', async () => {
        const Article = gp.getNodeByName('Article');
        const ArticleCreationInputType = Article.creationInputType;

        const input: utils.PlainObject = {
          title: "My article's title",
          status: undefined,
          category: {
            connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
          },
          createdBy: {
            connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          },
          updatedBy: {
            connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          },
        };

        const parsedValue = ArticleCreationInputType.parseValue(input)!;

        expect(parsedValue).toEqual({
          id: expect.any(String),
          title: "My article's title",
          status: ArticleStatus.DRAFT,
          category: {
            connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
          },
          createdBy: {
            connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          },
          createdAt: expect.any(Date),
          updatedBy: {
            connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          },
          updatedAt: expect.any(Date),
          views: 0n,
          score: 0.5,
        });

        const resolvedValue = await ArticleCreationInputType.resolveValue(
          parsedValue,
          new MutationContext(gp, myUserContext),
        );

        expect(resolvedValue).toEqual({
          id: expect.any(String),
          title: "My article's title",
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: expect.any(Date),
          updatedBy: { username: 'yvann' },
          updatedAt: expect.any(Date),
          views: 0n,
          score: 0.5,
        });

        const statement = new NodeCreationStatement(Article, resolvedValue);
        expect(statement).toBeInstanceOf(NodeCreationStatement);

        expect(statement.value).toEqual({
          id: expect.any(String),
          title: "My article's title",
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: expect.any(Date),
          updatedBy: { username: 'yvann' },
          updatedAt: expect.any(Date),
          views: 0n,
          score: 0.5,
        });
      });
    });
  });
});
