import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import {
  GraphQLDraftJS,
  normalizeRawDraftContentState,
  type RawDraftContentState,
} from './draft-js.js';

describe('DraftJS', () => {
  describe('invalids', () => {
    (
      [
        ['', 'Expects a plain-object, got: '],
        [' ', 'Expects a plain-object, got: '],
        [' \n \t ', 'Expects a plain-object, got: '],
        [
          {
            blocks: [],
            entityMap: {
              myInvalidKey: {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
            },
          },
          "/entityMap/myInvalidKey - Expects an integer, got: 'myInvalidKey'",
        ],
        [
          {
            blocks: [
              {
                key: 'abc',
                type: 'unstyled',
                text: 'abcde',
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [{ key: 'myInvalidKey', offset: 0, length: 5 }],
              },
            ],
            entityMap: {
              5: {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
            },
          },
          "/blocks/0/entityRanges/0/key - Expects an integer, got: 'myInvalidKey'",
        ],
        [
          {
            blocks: [
              {
                key: 'abc',
                type: 'unstyled',
                text: 'abcde',
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [{ key: 1, offset: 0, length: 5 }],
              },
            ],
            entityMap: [
              {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
            ],
          },
          '/blocks/0/entityRanges/0/key - Expects a value among "0", got: 1',
        ],
      ] as [input: any, error: string][]
    ).forEach(([input, error]) => {
      it(`parseValue(${inspect(input, undefined, 5)}) throws an error`, () => {
        assert.throws(() => GraphQLDraftJS.parseValue(input), {
          message: new RegExp(error),
        });
      });
    });
  });

  describe('valids', () => {
    (
      [
        [
          // entityMap with an object
          {
            blocks: [
              {
                key: 'abc',
                type: 'unstyled',
                text: 'abcde fghijk',
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [
                  { key: 0, offset: 0, length: 5 },
                  { key: 1, offset: 6, length: 5 },
                ],
              },
            ],
            entityMap: {
              0: {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
              1: {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/news' },
              },
            },
          },
        ],
        [
          // entityMap with an array
          {
            blocks: [
              {
                key: 'abc',
                type: 'unstyled',
                text: 'abcde',
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [{ key: 0, offset: 0, length: 5 }],
              },
            ],
            entityMap: [
              {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
            ] as any,
          },
        ],
      ] as [input: RawDraftContentState][]
    ).forEach(([input]) => {
      it(`parseValue(${inspect(input, undefined, 5)})`, () => {
        assert.ok(GraphQLDraftJS.parseValue(input));
      });

      it(`serialize(${inspect(input, undefined, 5)})`, () => {
        assert.ok(GraphQLDraftJS.serialize(input));
      });
    });

    (
      [
        [
          {
            blocks: [],
            entityMap: {
              myInvalidKey: {
                type: 'LINK',
                mutability: 'MUTABLE',
                data: { path: '/home' },
              },
            },
          },
          null,
        ],
        [
          {
            blocks: [
              {
                key: 'abc',
                type: 'unstyled',
                text: 'abcde',
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [{ key: 'myInvalidKey', offset: 0, length: 5 }],
              },
            ],
            entityMap: {
              5: {
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
                entityRanges: [],
              },
            ],
            entityMap: {},
          },
        ],
      ] as [input: any, output: RawDraftContentState | null][]
    ).forEach(([input, output]) => {
      it(`normalizeRawDraftContentState(${inspect(input, undefined, 5)})`, () => {
        assert.deepEqual(normalizeRawDraftContentState(input), output);
      });
    });
  });
});
