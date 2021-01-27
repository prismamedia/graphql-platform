import { GraphQLString, printType } from 'graphql';
import { NonNullableType } from '../wrapping/non-nullable';
import { NonOptionalType } from '../wrapping/non-optional';
import { InputObjectType } from './object';

describe('InputObjectType', () => {
  it('can have private fields', () => {
    const type = new InputObjectType({
      name: 'User',
      description: 'My status',
      fields: {
        username: {
          type: new NonOptionalType(new NonNullableType(GraphQLString)),
        },
        password: {
          type: new NonOptionalType(new NonNullableType(GraphQLString)),
          public: false,
        },
        age: {
          type: GraphQLString,
          deprecated: true,
        },
      },
    });

    expect([...type.fieldMap.keys()]).toEqual(
      expect.arrayContaining(['username', 'password']),
    );

    expect([...type.publicFieldMap.keys()]).toEqual(
      expect.arrayContaining(['username']),
    );

    expect(printType(type.graphql)).toMatchInlineSnapshot(`
"\\"\\"\\"My status\\"\\"\\"
input User {
  username: String!
  age: String @deprecated(reason: \\"\\\\\\"age\\\\\\" is deprecated\\")
}"
`);
  });
});
