import { config, MyGP } from '../../../../../__tests__/gp';
import { Resource } from '../../../../resource';
import { CreateOneValue } from '../value';

describe('Resource', () => {
  let gp: MyGP;
  let article: Resource;
  let tag: Resource;

  beforeAll(() => {
    gp = new MyGP(config);
    article = gp.getResourceMap().assert('Article');
    tag = gp.getResourceMap().assert('Tag');
  });

  it('throws an error on missing component value', () => {
    expect(() => new CreateOneValue(article, {})).toThrowError(
      'The "Article.format"\'s value is invalid: cannot be undefined.',
    );
  });

  it('creates a value', () => {
    const create = new CreateOneValue(tag, { title: 'My title' });

    expect(create.toNodeValue()).toEqual({ title: 'My title' });

    const { proxy, revoke } = create.toProxy();

    proxy.title = 'My new title';
    proxy.slug = 'my-new-title';

    expect(() => (proxy.unknownField = `Will throw en error as the "unknownField" field does not exist`)).toThrowError(
      'The resource "Tag" does not have the component "unknownField".',
    );

    expect(JSON.stringify(proxy)).toEqual('{"title":"My new title","slug":"my-new-title"}');
    expect(JSON.stringify(proxy)).toEqual(JSON.stringify(create));
    expect(create.toNodeValue()).toEqual({ title: 'My new title', slug: 'my-new-title' });

    // Can unset a "nullable" field
    proxy.slug = undefined;
    expect(create.toNodeValue()).toEqual({ title: 'My new title' });

    // Can't unset a "non-nullable" field
    expect(() => delete proxy.title).toThrowError('The "Tag.title"\'s value is invalid: cannot be undefined.');

    // Cannot set an invalid value
    expect(() => (proxy.title = undefined)).toThrowError('The "Tag.title"\'s value is invalid: cannot be undefined.');
    expect(() => (proxy.title = null)).toThrowError('The "Tag.title"\'s value is invalid: cannot be null.');
    expect(() => (proxy.title = true)).toThrowError(
      'The "Tag.title"\'s value is invalid: a string is expected but received "true" instead.',
    );

    revoke();

    expect(() => (proxy.title = 'Will throw en error as the proxy is revoked')).toThrowError(
      "Cannot perform 'set' on a proxy that has been revoked",
    );
  });
});
