import * as utils from '@prismamedia/graphql-platform-utils';
import { GraphQLInputObjectType, printType } from 'graphql';
import { GraphQLPlatform } from '../../../index.js';
import {
  MyGP,
  myUserContext,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { mockConnector } from '../../../__tests__/connector-mock.js';
import { MutationContext } from '../../operation.js';
import { LeafComparisonFilter } from '../../statement/filter.js';
import { NodeUpdate } from '../../statement/update.js';
import { NodeUpdateInputType } from './update.js';

describe('NodeUpdateInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        find: async ({ node, filter }) => {
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
              { id: '2059b77a-a735-41fe-b415-5b12944b6ba6', username: 'yvann' },
            ];
          }

          throw new Error('KO');
        },
      }),
    });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has an update input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const updateInputType = node.updateInputType;
      expect(updateInputType).toBeInstanceOf(NodeUpdateInputType);

      if (node.isMutationPublic(utils.MutationType.UPDATE)) {
        expect(updateInputType.getGraphQLInputType()).toBeInstanceOf(
          GraphQLInputObjectType,
        );

        expect(
          printType(updateInputType.getGraphQLInputType()),
        ).toMatchSnapshot(updateInputType.name);
      } else {
        expect(() => updateInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}UpdateInput" input type is private`,
        );
      }
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          {
            category: {},
          },
          '"ArticleUpdateInput.category" - Expects one and only one action, got: [Object: null prototype] {}',
        ],
        [
          'Article',
          {
            category: {
              connect: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
              connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
            },
          },
          '"ArticleUpdateInput.category" - Expects one and only one action, got: [Object: null prototype] {',
        ],
      ])(
        '%sUpdateInput.parseValue(%p) throws an error',
        (nodeName, value, error) => {
          const node = gp.getNodeByName(nodeName);
          const updateInputType = node.updateInputType;

          expect(() => updateInputType.parseValue(value)).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it.each([
        [
          'Article',
          {},
          {
            updatedAt: expect.any(Date),
          },
        ],
        [
          'Article',
          {
            title: 'My new title',
            category: null,
          },
          {
            title: 'My new title',
            category: null,
            updatedAt: expect.any(Date),
          },
        ],
      ])('%sUpdateInput.parseValue(%p)', (nodeName, value, update) => {
        const node = gp.getNodeByName(nodeName);
        const updateInputType = node.updateInputType;

        expect(updateInputType.parseValue(value)).toEqual(update);
      });

      it('creates a valid statement', async () => {
        const Article = gp.getNodeByName('Article');
        const ArticleUpdateInputType = Article.updateInputType;

        const input: utils.PlainObject = {
          title: "My new article's title",
          category: { disconnect: true },
        };

        const parsedInput = ArticleUpdateInputType.parseValue(input);

        expect(parsedInput).toEqual({
          title: "My new article's title",
          category: { disconnect: true },
          updatedAt: expect.any(Date),
        });

        const update = await ArticleUpdateInputType.createStatement(
          parsedInput!,
          new MutationContext(gp, myUserContext),
        );

        expect(update).toBeInstanceOf(NodeUpdate);

        const proxy = update.proxy;
        expect(proxy).toBeInstanceOf(NodeUpdate);
        expect({ ...proxy }).toEqual({
          title: "My new article's title",
          category: null,
          updatedAt: expect.any(Date),
        });
      });
    });
  });
});
