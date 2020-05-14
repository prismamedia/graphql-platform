import { config, MyGP } from '../../../../../__tests__/gp';
import { Resource } from '../../../../resource';
import { UpdateOneValue } from '../value';

describe('Resource', () => {
  let gp: MyGP;
  let tag: Resource;

  beforeAll(() => {
    gp = new MyGP(config);
    tag = gp.getResourceMap().assert('Tag');
  });

  it('creates an empty value', () => {
    const update = new UpdateOneValue(tag, {});

    expect(update.toNodeValue()).toEqual({});
  });

  it('creates a value', () => {
    const update = new UpdateOneValue(tag, { title: 'My title' });

    expect(update.toNodeValue()).toEqual({ title: 'My title' });

    const { proxy, revoke } = update.toProxy();

    proxy.title = 'My new title';
    proxy.slug = 'my-new-title';

    expect(
      () =>
        (proxy.unknownField = `Will throw en error as the "unknownField" field does not exist`),
    ).toThrowError(
      'The resource "Tag" does not have the component "unknownField".',
    );

    expect(JSON.stringify(proxy)).toEqual(
      '{"title":"My new title","slug":"my-new-title"}',
    );
    expect(JSON.stringify(proxy)).toEqual(JSON.stringify(update));
    expect(update.toNodeValue()).toEqual({
      title: 'My new title',
      slug: 'my-new-title',
    });

    // Can unset a "nullable" field
    proxy.slug = undefined;
    delete proxy.slug;
    expect(update.toNodeValue()).toEqual({ title: 'My new title' });

    // Can unset a "non-nullable" field
    proxy.title = undefined;
    delete proxy.title;
    expect(update.toNodeValue()).toEqual({});

    // Cannot set an invalid value
    expect(() => (proxy.title = null)).toThrowError(
      'The "Tag.title"\'s value is invalid: cannot be null.',
    );
    expect(() => (proxy.title = true)).toThrowError(
      'The "Tag.title"\'s value is invalid: a string is expected but received "true" instead.',
    );
    expect(() => (proxy.slug = null)).toThrowError(
      'The "Tag.slug"\'s value is invalid: cannot be null.',
    );
    expect(() => (proxy.slug = true)).toThrowError(
      'The "Tag.slug"\'s value is invalid: a string is expected but received "true" instead.',
    );

    revoke();

    expect(
      () => (proxy.title = 'Will throw en error as the proxy is revoked'),
    ).toThrowError("Cannot perform 'set' on a proxy that has been revoked");
  });
});
