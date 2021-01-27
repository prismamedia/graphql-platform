import { isIterable, isIterableObject } from './iterable';

describe('Iterable', () => {
  it.each([['abc'], [['a', 'b', 'c']]])('%p is iterable', (maybeIterable) => {
    expect(isIterable(maybeIterable)).toBeTruthy();
  });

  it.each([[12]])('%p is not iterable', (maybeIterable) => {
    expect(isIterable(maybeIterable)).toBeFalsy();
  });

  it.each([[['a', 'b', 'c']]])('%p is an iterable object', (maybeIterable) => {
    expect(isIterableObject(maybeIterable)).toBeTruthy();
  });

  it.each([['abc']])('%p is not an iterable object', (maybeIterable) => {
    expect(isIterableObject(maybeIterable)).toBeFalsy();
  });
});
