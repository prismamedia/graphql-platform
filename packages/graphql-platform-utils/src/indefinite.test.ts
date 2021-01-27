import { indefinite, IndefiniteOptions } from './indefinite';

describe('Indefinite', () => {
  it.each<
    [input: string, options: IndefiniteOptions | undefined, result: string]
  >([
    ['article', undefined, 'an article'],
    ['category', undefined, 'a category'],
    ['category', { quote: true }, 'a "category"'],
  ])('indefinite(%p, %p) = %p', (input, options, result) => {
    expect(indefinite(input, options)).toEqual(result);
  });
});
