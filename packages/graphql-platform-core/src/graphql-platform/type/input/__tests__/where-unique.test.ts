import { POJO } from '@prismamedia/graphql-platform-utils';
import { printType } from 'graphql';
import { config, MyGP } from '../../../../__tests__/gp';
import { Resource } from '../../../resource';
import { Relation } from '../../../resource/component';
import { ResourceMap } from '../../../resource/map';
import { WhereUniqueInputValue } from '../where-unique';

describe('WhereUniqueInput', () => {
  let gp: MyGP;
  let resourceMap: ResourceMap;

  beforeAll(() => {
    gp = new MyGP(config);
    resourceMap = gp.getResourceMap();
  });

  it.each([
    ['Article', ['category']],
    ['ArticleTag', ['article', 'tag']],
  ] as ReadonlyArray<[Resource['name'], Relation['name'][] | undefined]>)(
    'creates a valid GraphQL "WhereUniqueInput" type',
    (resourceName: Resource['name'], relationNames?: Relation['name'][]) => {
      const resource = resourceMap.assert(resourceName);

      expect(
        printType(resource.getInputType('WhereUnique').getGraphQLType(), {
          commentDescriptions: true,
        }),
      ).toMatchSnapshot();

      if (relationNames) {
        relationNames.forEach((relationName) => {
          const relation = resource.getRelationMap().assert(relationName);

          expect(
            printType(
              resource
                .getInputType('WhereUnique')
                .getGraphQLType(relation, false),
              {
                commentDescriptions: true,
              },
            ),
          ).toMatchSnapshot();

          expect(
            printType(
              resource
                .getInputType('WhereUnique')
                .getGraphQLType(relation, true),
              {
                commentDescriptions: true,
              },
            ),
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
          resourceMap.assert('Article').getRelationMap().assert('author'),
          false,
        ),
    ).toThrowErrorMatchingInlineSnapshot(
      `"The relation \\"Article.author\\" is not part of the \\"Article\\"'s unique constraints: _id, id, category-slug"`,
    );
  });

  it.each([[undefined], [null], [{}]] as ReadonlyArray<any>)(
    'throws error on invalid values',
    (value) => {
      expect(() =>
        resourceMap.assert('Article').getInputType('WhereUnique').assert(value),
      ).toThrowError(
        'The following "Article"\'s identifier does not contain any valid',
      );
    },
  );

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
      expect(
        resourceMap.assert('Article').getInputType('WhereUnique').parse(value),
      ).toEqual(whereUniqueInputValue);
    },
  );
});
