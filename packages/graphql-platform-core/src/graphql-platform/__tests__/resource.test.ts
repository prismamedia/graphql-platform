import { POJO } from '@prismamedia/graphql-platform-utils';
import { config, MyGP } from '../../__tests__/gp';
import { Resource } from '../resource';

describe('Resource', () => {
  let gp: MyGP;
  let articleResource: Resource;

  beforeAll(() => {
    gp = new MyGP(config);
    articleResource = gp.getResourceMap().assert('Article');
  });

  it.each([
    [{ title: 'Test' }, { title: 'Test' }],
    [{ body: null }, { body: null }],
    [{ body: 'Body test' }, { body: 'Body test' }],
    [{ title: 'Test', unknownProperty: null }, { title: 'Test' }],
    [{ title: 'Test', category: { slug: 'category-slug' } }, { title: 'Test', category: { slug: 'category-slug' } }],
    [
      { title: 'Test', category: { slug: 'category-slug', parent: { id: 'a3b9f2a2-84e1-4430-a520-f3af562471a7' } } },
      { title: 'Test', category: { slug: 'category-slug', parent: { id: 'a3b9f2a2-84e1-4430-a520-f3af562471a7' } } },
    ],
    [
      { title: 'Test', category: { slug: 'category-slug', parent: null } },
      { title: 'Test', category: { slug: 'category-slug', parent: null } },
    ],
    [
      { title: 'Test', category: { slug: 'category-slug', parent: undefined } },
      { title: 'Test', category: { slug: 'category-slug' } },
    ],
  ] as ReadonlyArray<[POJO, POJO]>)('parses value', (rawValue, parsedValue) => {
    expect(articleResource.parseValue(rawValue, false, false)).toEqual(parsedValue);
  });

  it.each([null, 0, true, false, 'string'])('throws error for invalid value', value => {
    expect(() => articleResource.parseValue(value, false, false)).toThrowError(
      /^The "Article" node's value has to be a plain object: (.+)/,
    );
  });

  it.each([{ id: null }, { category: null }])('throws error for non-nullable component value', value => {
    expect(() => articleResource.parseValue(value, false, false)).toThrowError(
      /^The "Article.(id|category)" (field|relation)'s value cannot be null/,
    );
  });

  it.each([{ id: {} }, { category: 5 }])('throws error for invalid component value', value => {
    expect(() => articleResource.parseValue(value, false, false)).toThrowError(
      /^The "Article.(id|category)" (field's value is not valid: (.+)|relation's value has to be a plain object)/,
    );
  });
});
