import assert from 'node:assert';
import { describe, it } from 'node:test';
import { indefinite } from './indefinite.js';

describe('Indefinite', () => {
  it('returns correct indefinite articles', () => {
    const cases = [
      ['article', 'an "article"'],
      ['Article', 'an "Article"'],
      ['category', 'a "category"'],
      ['Category', 'a "Category"'],
    ] as const;

    cases.forEach(([input, expectation]) => {
      assert.strictEqual(indefinite(input), expectation);
    });
  });
});
