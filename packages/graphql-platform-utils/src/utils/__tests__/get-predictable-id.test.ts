import { getPredictableId, getPredictableSequence } from '../get-predictable-id';

describe('get-short-id', () => {
  it('generates a predictable sequence', () => {
    const charset = 'abc';

    expect([...new Array(10)].map((_, index) => getPredictableSequence(index, charset))).toEqual([
      'a',
      'b',
      'c',
      'aa',
      'ab',
      'ac',
      'ba',
      'bb',
      'bc',
      'ca',
    ]);
  });

  it('generates predictable ids', () => {
    const charset = 'abc';

    expect(getPredictableId([], { charset })).toEqual('a');
    expect(getPredictableId(['a'], { charset })).toEqual('b');
    expect(getPredictableId(['a', 'b'], { charset })).toEqual('c');
    expect(getPredictableId(['a', 'b', 'c'], { charset })).toEqual('aa');
    expect(getPredictableId(['a', 'b', 'c', 'aa'], { charset })).toEqual('ab');
  });
});
