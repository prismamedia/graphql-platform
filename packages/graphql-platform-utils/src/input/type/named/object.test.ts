import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLString,
  printType,
} from 'graphql';
import { Input } from '../../../input.js';
import {
  ListableInputType,
  nonNillableInputType,
  NonNullableInputType,
} from '../wrapping.js';
import { ObjectInputType } from './object.js';

describe('ObjectInputType', () => {
  it('is public if it has at least one public field', () => {
    const test0 = new ObjectInputType({
      name: 'Test0',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: GraphQLBoolean,
          public: false,
        }),
      ],
    });

    expect(test0.validate()).toBeUndefined();
    expect(test0.isPublic()).toBeTruthy();
  });

  it('supports circular dependencies', () => {
    let test0: ObjectInputType;
    let test1: ObjectInputType;

    test0 = new ObjectInputType({
      name: 'Test0',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: new ListableInputType(test0),
        }),
        new Input({
          name: 'thirdField',
          type: test1,
        }),
      ],
    });

    test1 = new ObjectInputType({
      name: 'Test1',
      fields: () => [
        new Input({
          name: 'firstField',
          type: GraphQLBoolean,
        }),
        new Input({
          name: 'secondField',
          type: test0,
        }),
        new Input({
          name: 'thirdField',
          type: new ListableInputType(test1),
        }),
      ],
    });

    expect(test0.validate()).toBeUndefined();
    expect(test1.validate()).toBeUndefined();
    expect(test0.isPublic()).toBeTruthy();
    expect(test1.isPublic()).toBeTruthy();
  });

  describe('Public type', () => {
    const type = new ObjectInputType({
      name: 'SimpleInput',
      fields: () => [
        new Input({
          name: 'longitude',
          type: new NonNullableInputType(GraphQLFloat),
        }),
        new Input({
          name: 'latitude',
          type: new NonNullableInputType(GraphQLFloat),
        }),
      ],
    });

    it(`${type} is public`, () => {
      expect(type.isPublic()).toBeTruthy();
    });

    it(`${type} has GraphQL`, () => {
      expect(printType(type.getGraphQLInputType())).toMatchInlineSnapshot(`
        "input SimpleInput {
          longitude: Float
          latitude: Float
        }"
      `);
    });

    it.each([
      [undefined, undefined],
      [null, null],
      [{}, {}],
      [{ longitude: undefined }, {}],
    ])(`${type}.parseValue(%p) = %p`, (input, output) =>
      expect(type.parseValue(input)).toEqual(output),
    );
  });

  describe('Public type with circular reference', () => {
    let type: ObjectInputType;

    type = new ObjectInputType({
      name: 'ProfileInput',
      description: 'My profile',
      fields: () => [
        new Input({
          name: 'withDeepReference',
          type: new ObjectInputType({
            name: 'DeepTypeWithReference',
            fields: () => [
              new Input({
                name: 'from',
                type: nonNillableInputType(type),
              }),
              new Input({
                name: 'to',
                type: nonNillableInputType(type),
              }),
            ],
          }),
        }),
        new Input({
          name: 'username',
          type: nonNillableInputType(GraphQLString),
        }),
        new Input({
          name: 'password',
          public: false,
          type: GraphQLString,
        }),
        new Input({
          name: 'age',
          type: GraphQLInt,
          deprecated: true,
        }),
        new Input({
          name: 'friends',
          type: nonNillableInputType(
            new ListableInputType(nonNillableInputType(type)),
          ),
          defaultValue: [],
        }),
      ],
    });

    it(`${type} is valid`, () => {
      expect(type.validate()).toBeUndefined();
    });

    it(`${type} is public`, () => {
      expect(type.isPublic()).toBeTruthy();
    });

    it(`${type} has GraphQL`, () => {
      expect(printType(type.getGraphQLInputType())).toMatchInlineSnapshot(`
        """"My profile"""
        input ProfileInput {
          username: String!
          age: Int @deprecated(reason: "\\"age\\" is deprecated")
          friends: [ProfileInput!]! = []
        }"
      `);
    });

    it.each([
      [undefined, undefined],
      [null, null],
      [{ username: 'yvann' }, { username: 'yvann', friends: [] }],
      [
        { username: 'yvann', friends: [{ username: 'marine' }] },
        { username: 'yvann', friends: [{ username: 'marine', friends: [] }] },
      ],
    ])(`${type}.parseValue(%p) = %p`, (input, output) =>
      expect(type.parseValue(input)).toEqual(output),
    );
  });
});
