import { GraphQLNonEmptyTrimmedString } from './non-empty-trimmed-string';

describe('NonEmptyTrimmedString', () => {
  it.each(['', ' ', ' \n \t '])('throws an Error on invalid value', (input) => {
    expect(() => GraphQLNonEmptyTrimmedString.serialize(input)).toThrowError(
      /NonEmptyTrimmedString expects a non empty string, got/,
    );
  });

  it('serializes', () => {
    expect(GraphQLNonEmptyTrimmedString.serialize('\n ok \t ')).toEqual('ok');
  });

  it('parses', () => {
    expect(GraphQLNonEmptyTrimmedString.parseValue('\n ok \t ')).toEqual('ok');
  });
});
