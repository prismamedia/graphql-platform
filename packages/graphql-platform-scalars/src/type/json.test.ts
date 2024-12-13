import * as graphql from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import type { JsonValue } from 'type-fest';
import { GraphQLJSONArray, GraphQLJSONObject } from './json.js';

describe('JSON', () => {
  describe('invalids', () => {
    (
      [
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
      ] as [type: graphql.GraphQLScalarType, input: any, error: string][]
    ).forEach(([type, input, error], index) => {
      it(`${type.name}.parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => type.parseValue(input), { message: error });
      });
    });
  });

  describe('valids', () => {
    (
      [
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
      ] as [
        type: graphql.GraphQLScalarType,
        input: JsonValue,
        output: JsonValue,
      ][]
    ).forEach(([type, input, output], index) => {
      it(`${type.name}.parseValue(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
        assert.deepEqual(type.parseValue(input), output);
      });

      it(`${type.name}.serialize(${inspect(input, undefined, 5)}) = ${inspect(output, undefined, 5)}`, () => {
        assert.deepEqual(type.serialize(input), output);
      });
    });
  });
});
