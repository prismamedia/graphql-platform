import { didYouMean } from './did-you-mean';

describe('didYouMean', () => {
  it('works', () => {
    expect(didYouMean('user', ['Article', 'User', 'uSer'])).toEqual(
      'User, uSer, Article',
    );
  });
});
