import { printType } from 'graphql';
import { EnumInputType, EnumInputValue } from './enum.js';

describe('InputEnumType', () => {
  let enumType: EnumInputType;

  beforeAll(() => {
    enumType = new EnumInputType({
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
  });

  it('has values', () => {
    expect([...enumType.publicEnumValuesByValue.keys()]).toEqual([
      'DRAFT',
      'FROZEN',
      'PUBLISHED',
    ]);

    expect([...enumType.enumValuesByValue.keys()]).toEqual([
      'DRAFT',
      'FROZEN',
      'PUBLISHED',
      'DELETED',
    ]);

    expect(printType(enumType.getGraphQLInputType())).toMatchInlineSnapshot(`
"\\"\\"\\"My status\\"\\"\\"
enum Status {
  DRAFT
  FROZEN @deprecated(reason: \\"\\\\\\"FROZEN\\\\\\" is deprecated\\")

  \\"\\"\\"The item is published\\"\\"\\"
  UsedToBePublished
}"
`);
  });

  it.each([
    { value: undefined },
    { value: null },
    { value: 'DRAFT' },
    { value: 'FROZEN' },
    { value: 'PUBLISHED' },
    { value: 'DELETED' },
  ])('Status.parseValue($value) = $value', ({ value }) =>
    expect(enumType.parseValue(value)).toEqual(value),
  );
});
