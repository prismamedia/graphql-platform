import { describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import type { JsonValue } from 'type-fest';
import { GraphQLJSONArray, GraphQLJSONObject } from './json.js';

describe('JSON', () => {
  it.each<[type: graphql.GraphQLScalarType, input: any, error: string]>([
    [GraphQLJSONObject, '', "Expects a plain-object, got: ''"],
    [GraphQLJSONObject, [], 'Expects a plain-object, got: []'],
    [GraphQLJSONArray, '', "Expects an array, got: ''"],
    [GraphQLJSONArray, {}, 'Expects an array, got: {}'],
    [
      GraphQLJSONArray,
      [new Date('2022-01-28T14:52:09.306Z'), BigInt(123), undefined],
      `3 errors:
└ /0 - Expects a JSON primitive (= a string, a number, a boolean or null), got: 2022-01-28T14:52:09.306Z
└ /1 - Expects a JSON primitive (= a string, a number, a boolean or null), got: 123n
└ /2 - Expects a JSON primitive (= a string, a number, a boolean or null), got: undefined`,
    ],
  ])(
    '%p.parseValue(%p) throws an Error on invalid value',
    (type, input, error) => {
      expect(() => type.parseValue(input)).toThrowError(error);
    },
  );

  it.each<
    [type: graphql.GraphQLScalarType, input: JsonValue, output: JsonValue]
  >([
    [
      GraphQLJSONObject,
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 'myKey', offset: 0, length: 5 }],
          },
        ],
        entityMap: {
          myKey: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        },
      },
      {
        blocks: [
          {
            key: 'abc',
            type: 'unstyled',
            text: 'abcde',
            depth: 0,
            inlineStyleRanges: [],
            entityRanges: [{ key: 'myKey', offset: 0, length: 5 }],
          },
        ],
        entityMap: {
          myKey: {
            type: 'LINK',
            mutability: 'MUTABLE',
            data: { path: '/home' },
          },
        },
      },
    ],
    [
      GraphQLJSONArray,
      [
        {
          key: 'abc',
          type: 'unstyled',
          text: 'abcde',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [{ key: 0, offset: 0, length: 5 }],
        },
        'first',
        1,
        null,
      ],
      [
        {
          key: 'abc',
          type: 'unstyled',
          text: 'abcde',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [{ key: 0, offset: 0, length: 5 }],
        },
        'first',
        1,
        null,
      ],
    ],
  ])('%p.parseValue(%p) = %p', (type, input, output) => {
    expect(type.parseValue(input)).toEqual(output);
    expect(type.serialize(input)).toEqual(output);
  });
});
