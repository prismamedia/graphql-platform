import { POJO } from '@prismamedia/graphql-platform-utils';
import { printType } from 'graphql';
import { graphqlPlatform } from '../../../../__tests__';
import { Resource } from '../../../resource';
import { Relation } from '../../../resource/component';
import { WhereUniqueInputValue } from '../where-unique';

describe('WhereUniqueInput', () => {
  const resourceMap = graphqlPlatform.getResourceMap();

  it.each([
    [
      resourceMap.assert('Article'),
      [
        resourceMap
          .assert('Article')
          .getRelationMap()
          .assert('category'),
      ],
    ],
    [
      resourceMap.assert('ArticleTag'),
      [
        resourceMap
          .assert('ArticleTag')
          .getRelationMap()
          .assert('article'),
        ,
        resourceMap
          .assert('ArticleTag')
          .getRelationMap()
          .assert('tag'),
      ],
    ],
  ] as ReadonlyArray<[Resource, Relation[] | undefined]>)(
    'creates a valid GraphQL "WhereUniqueInput" type',
    (resource: Resource, relations?: Relation[]) => {
      expect(
        printType(resource.getInputType('WhereUnique').getGraphQLType(), { commentDescriptions: true }),
      ).toMatchSnapshot();

      if (relations) {
        relations.forEach(relation => {
          expect(
            printType(resource.getInputType('WhereUnique').getGraphQLType(relation), { commentDescriptions: true }),
          ).toMatchSnapshot();

          expect(
            printType(resource.getInputType('WhereUnique').getGraphQLType(relation, true), {
              commentDescriptions: true,
            }),
          ).toMatchSnapshot();
        });
      }
    },
  );

  it('throws an error on unknown component', () => {
    expect(() =>
      resourceMap
        .assert('Article')
        .getInputType('WhereUnique')
        .getGraphQLType(
          resourceMap
            .assert('Article')
            .getRelationMap()
            .assert('author'),
        ),
    ).toThrowErrorMatchingInlineSnapshot(
      `"The component \\"Article.author\\" is not part of the \\"Article\\"'s unique constraints: _id, id, category, slug"`,
    );
  });

  it.each([[undefined], [null], [{}]] as ReadonlyArray<any>)('parses value into "undefined"', value => {
    expect(
      resourceMap
        .assert('Article')
        .getInputType('WhereUnique')
        .parse(value),
    ).toBeUndefined();
  });

  it.each([
    [
      {
        _id: 100,
        id: '100',
        category: {
          _id: 10,
        },
        slug: 'a-valid-article-slug',
      },
      { _id: 100 },
    ],
    [
      {
        id: '100',
        category: {
          _id: 10,
        },
        slug: 'a-valid-article-slug',
      },
      { id: '100' },
    ],
    [
      {
        category: {
          _id: 10,
          parent: {
            id: '31cc2a48-551a-4b59-82cd-c4336a217dca',
          },
          slug: 'a-valid-category-slug',
        },
        slug: 'a-valid-article-slug',
      },
      {
        category: {
          parent: {
            id: '31cc2a48-551a-4b59-82cd-c4336a217dca',
          },
          slug: 'a-valid-category-slug',
        },
        slug: 'a-valid-article-slug',
      },
    ],
    [
      {
        category: {
          _id: 10,
          parent: null,
          slug: 'a-valid-category-slug',
        },
        slug: 'a-valid-article-slug',
      },
      {
        category: {
          parent: null,
          slug: 'a-valid-category-slug',
        },
        slug: 'a-valid-article-slug',
      },
    ],
  ] as ReadonlyArray<[WhereUniqueInputValue, POJO]>)(
    'parses value into "whereUniqueInputValue"',
    (value, whereUniqueInputValue) => {
      const id = resourceMap
        .assert('Article')
        .getInputType('WhereUnique')
        .parse(value);

      expect(id).toEqual(whereUniqueInputValue);
    },
  );
});
