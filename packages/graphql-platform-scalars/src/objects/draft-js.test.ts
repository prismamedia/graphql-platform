import { RawDraftContentState } from 'draft-js';
import { GraphQLDraftJS } from './draft-js';

const validRawDraftContentState: RawDraftContentState = {
  blocks: [],
  entityMap: {},
};

describe('DraftJS', () => {
  it.each(['', ' ', ' \n \t '])('throws an Error on invalid value', (input) => {
    expect(() => GraphQLDraftJS.serialize(input)).toThrowError(
      /JSONObject cannot represent non-object value:/,
    );
  });

  it('serializes', () => {
    expect(GraphQLDraftJS.serialize(validRawDraftContentState)).toEqual(
      validRawDraftContentState,
    );
  });

  it('parses', () => {
    expect(GraphQLDraftJS.parseValue(validRawDraftContentState)).toEqual(
      validRawDraftContentState,
    );
  });
});
