import { printType } from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { EnumInputType, EnumInputValue } from './enum.js';

describe('InputEnumType', () => {
  const enumType = new EnumInputType({
    name: 'Status',
    description: 'My status',
    values: () => [
      new EnumInputValue({ value: 'DRAFT' }),
      new EnumInputValue({
        value: 'FROZEN',
        deprecated: true,
      }),
      new EnumInputValue({
        value: 'PUBLISHED',
        name: 'UsedToBePublished',
        description: 'The item is published',
      }),
      new EnumInputValue({ value: 'DELETED', public: false }),
    ],
  });

  it('has values', ({ assert: { snapshot } }) => {
    assert.deepStrictEqual(
      [...enumType.publicEnumValuesByValue.keys()],
      ['DRAFT', 'FROZEN', 'PUBLISHED'],
    );

    assert.deepStrictEqual(
      [...enumType.enumValuesByValue.keys()],
      ['DRAFT', 'FROZEN', 'PUBLISHED', 'DELETED'],
    );

    snapshot(printType(enumType.getGraphQLInputType()));
  });

  {
    const cases = [
      { value: undefined },
      { value: null },
      { value: 'DRAFT' },
      { value: 'FROZEN' },
      { value: 'PUBLISHED' },
      { value: 'DELETED' },
    ] as const;

    cases.forEach(({ value }) =>
      it(`Status.parseValue(${inspect(value, undefined, 5)}) = ${inspect(value, undefined, 5)}`, () =>
        assert.strictEqual(enumType.parseValue(value), value)),
    );
  }
});
