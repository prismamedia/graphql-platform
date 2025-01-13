import assert from 'node:assert';
import { describe, it } from 'node:test';
import { GraphQLPlatform } from '../../../index.js';

describe('Leaf', () => {
  const gp = new GraphQLPlatform({
    nodes: {
      Url: {
        components: {
          id: {
            type: 'UUIDv4',
            mutable: false,
            nullable: false,
          },
          href: {
            type: 'URL',
            nullable: false,
          },
        },
        uniques: [['id']],
      },
    },
  });

  it('should deduplicate values', () => {
    const Url = gp.getNodeByName('Url');
    const href = Url.getLeafByName('href');

    const a =
      'http://prd2-bone-image.s3-website-eu-west-1.amazonaws.com/fac/2024/04/12/530e3a1a-7ece-43c6-ba46-d142fb1910fd.jpeg';
    const parsedA = href.parseValue(a);
    assert(parsedA instanceof URL);
    assert.strictEqual(parsedA.href, a);

    const b =
      'https://i.pmdstatic.net/fac/2024/04/12/530e3a1a-7ece-43c6-ba46-d142fb1910fd.jpeg';
    const parsedB = href.parseValue(b);
    assert(parsedB instanceof URL);
    assert.strictEqual(parsedB.href, b);
    assert(!href.areValuesEqual(parsedA, parsedB));

    const c =
      'http://prd2-bone-image.s3-website-eu-west-1.amazonaws.com/fac/2024/04/12/530e3a1a-7ece-43c6-ba46-d142fb1910fd.jpeg';
    const parsedC = href.parseValue(c);
    assert(parsedC instanceof URL);
    assert.strictEqual(parsedC.href, c);
    assert(href.areValuesEqual(parsedA, parsedC));

    assert.deepEqual(
      Url.filterInputType.parseAndFilter({
        OR: [{ href: a }, { href: b }, { href: c }],
      }).inputValue,
      { href_in: [parsedA, parsedB] },
    );
  });
});
