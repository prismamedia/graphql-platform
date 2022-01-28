import { indefinite } from './indefinite.js';

describe('Indefinite', () => {
  it.each<[input: string, expectation: string]>([
    ['article', 'an "article"'],
    ['Article', 'an "Article"'],
    ['category', 'a "category"'],
    ['Category', 'a "Category"'],
  ])('indefinite(%p) = %p', (input, expectation) => {
    expect(indefinite(input)).toBe(expectation);
  });
});
