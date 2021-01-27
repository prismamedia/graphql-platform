import { printType } from 'graphql';
import { InputEnumType } from './enum';

describe('InputEnumType', () => {
  it('can have private fields', () => {
    const type = new InputEnumType({
      name: 'Test00',
      description: 'My status',
      values: [
        'DRAFT',
        {
          value: 'FROZEN',
          deprecated: true,
        },
        {
          value: 'PUBLISHED',
          name: 'UsedToBePublished',
          description: 'The item is published',
        },
        { value: 'DELETED', public: false },
      ],
    });

    expect([...type.publicValueMap.keys()]).toEqual(
      expect.arrayContaining(['DRAFT', 'PUBLISHED']),
    );

    expect([...type.valueMap.keys()]).toEqual(
      expect.arrayContaining(['DRAFT', 'PUBLISHED', 'DELETED']),
    );

    expect(printType(type.graphql)).toMatchInlineSnapshot(`
"\\"\\"\\"My status\\"\\"\\"
enum Test00 {
  DRAFT
  FROZEN @deprecated(reason: \\"\\\\\\"FROZEN\\\\\\" is deprecated\\")

  \\"\\"\\"The item is published\\"\\"\\"
  UsedToBePublished
}"
`);
  });
});
