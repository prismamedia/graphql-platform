import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLString,
  graphqlSync,
} from 'graphql';
import { getResolverPath } from '.';
import { GraphQLArgumentConfigMap, assertLeafValue } from './graphql';
import { printPath } from './path';

const typeDefs = `
type Category {
  id: String
  title: String
}

type Article {
  id: String
  title: String
  category: Category
}

type Query {
  article: Article
}

schema {
  query: Query
}
`;

describe('GraphQL', () => {
  it('getResolverPath', () => {
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          article(_, args, context, info) {
            expect(printPath(getResolverPath(info))).toEqual('myArticle');

            return {
              id: 'c385c2b1-59df-48c6-bd97-70284d480ba3',
              title: 'My article',
              category: {
                id: 'b4a2a95d-e84e-4731-91d5-eb6de527cea0',
                title: 'My category',
              },
            };
          },
        },
        Category: {
          id({ id }, args, context, info) {
            expect(printPath(getResolverPath(info))).toEqual(
              'myArticle.category.id',
            );

            return id;
          },
          title({ title }, args, context, info) {
            expect(printPath(getResolverPath(info))).toEqual(
              'myArticle.category.title',
            );

            return title;
          },
        },
        Article: {
          id({ id }, args, context, info) {
            expect(printPath(getResolverPath(info))).toEqual('myArticle.anId');

            return id;
          },
          title({ title }, args, context, info) {
            expect(printPath(getResolverPath(info))).toEqual('myArticle.title');

            return title;
          },
        },
      },
    });

    expect(
      graphqlSync({
        schema,
        source: `{
          myArticle: article {
            anId: id
            title
            category {
              title
            }
          }
        }`,
      }),
    ).toEqual({
      data: {
        myArticle: {
          anId: 'c385c2b1-59df-48c6-bd97-70284d480ba3',
          title: 'My article',
          category: {
            title: 'My category',
          },
        },
      },
    });
  });

  it('provides some useful types', () => {
    const withoutArgumentMap: GraphQLArgumentConfigMap<undefined> = undefined;

    const withArgumentMap: GraphQLArgumentConfigMap<{
      skip: number;
      first: number;
    }> = {
      skip: {
        type: GraphQLInt,
      },
      first: {
        type: GraphQLInt,
      },
    };

    const withOptionalArgumentMap: GraphQLArgumentConfigMap<{
      skip?: number;
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
    };
  });

  it('spots some definition errors', () => {
    // @ts-expect-error
    const withMissingArgumentMap: GraphQLArgumentConfigMap<{
      skip: number;
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
    };

    const withExtraArgumentMap: GraphQLArgumentConfigMap<{
      first: number;
    }> = {
      first: {
        type: GraphQLInt,
      },
      // @ts-expect-error
      where: {
        type: GraphQLInt,
      },
    };
  });

  it.each([
    [GraphQLBoolean, true],
    [GraphQLString, 'A string'],
    [
      new GraphQLEnumType({
        name: 'An enum test',
        values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
      }),
      'TWO',
    ],
  ])('%p.parseValue(%p) = %p', (type, value) => {
    expect(assertLeafValue(type, value)).toEqual(value);
  });

  it.each([
    [GraphQLBoolean, undefined],
    [GraphQLBoolean, null],
    [GraphQLBoolean, 'A string'],
    [
      new GraphQLEnumType({
        name: 'An enum test',
        values: { first: { value: 'FIRST' }, two: { value: 'TWO' } },
      }),
      'THIRD',
    ],
  ])('%p.parseValue(%p) throws an Error', (type, value) => {
    expect(() => assertLeafValue(type, value)).toThrowError();
  });
});
