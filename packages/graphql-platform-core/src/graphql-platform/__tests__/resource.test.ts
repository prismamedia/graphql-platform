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
      { title: 'Test', category: { slug: 'category-slug', parent: { slug: 'category-parent-slug' } } },
      { title: 'Test', category: { slug: 'category-slug', parent: { slug: 'category-parent-slug' } } },
    ],
    [
      { title: 'Test', category: { slug: 'category-slug', parent: null } },
      { title: 'Test', category: { slug: 'category-slug', parent: null } },
    ],
  ] as ReadonlyArray<[POJO, POJO]>)('parses value', (rawValue, parsedValue) => {
    expect(articleResource.parseValue(rawValue)).toEqual(parsedValue);
  });

  it.each([null, 0, true, false, 'string'])('throws error for invalid value', value => {
    expect(() => articleResource.parseValue(value)).toThrowError(
      /^The "Article" node's value has to be a plain object: (.+)/,
    );
  });

  it('throws error for non-nullable component value', () => {
    expect(() => articleResource.parseValue({ id: null })).toThrowError(
      'The "Article.id" field\'s value has to be a non-null scalar: "null" given.',
    );
  });

  it('throws error for invalid component value', () => {
    expect(() => articleResource.parseValue({ id: {} })).toThrowError(
      'The "Article.id" field\'s value has to be a non-null scalar: "[object Object]" given',
    );
  });

  it('throws error for invalid component value', () => {
    expect(() => articleResource.parseValue({ category: 5 })).toThrowError(
      'The "Category" node\'s value has to be a plain object: "5" given.',
    );
  });
});
