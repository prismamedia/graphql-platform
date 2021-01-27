import {
  assertPlainObject,
  isPlainObject,
} from '@prismamedia/graphql-platform-utils';
import type { RawDraftContentBlock, RawDraftContentState } from 'draft-js';
import { GraphQLJSONObject } from 'graphql-scalars';
import { GraphQLScalarType } from '../types';

export function ensureRawDraftContentBlockValue(
  value: unknown,
): RawDraftContentBlock {
  assertPlainObject(value);

  if (typeof value.key !== 'string') {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "key" property, got: ${value}`,
    );
  }

  if (typeof value.type !== 'string') {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "type" property, got: ${value}`,
    );
  }

  if (typeof value.text !== 'string') {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "text" property, got: ${value}`,
    );
  }

  if (typeof value.depth !== 'number') {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "depth" property, got: ${value}`,
    );
  }

  if (!Array.isArray(value.inlineStyleRanges)) {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "inlineStyleRanges" property, got: ${value}`,
    );
  }

  if (!Array.isArray(value.entityRanges)) {
    throw new TypeError(
      `RawDraftContentBlock expects a valid "entityRanges" property, got: ${value}`,
    );
  }

  return value as RawDraftContentBlock;
}

export function ensureRawDraftContentStateValue(
  value: unknown,
): RawDraftContentState {
  assertPlainObject(value);

  if (
    !(
      Array.isArray(value.blocks) &&
      value.blocks.every((block) => !!ensureRawDraftContentBlockValue(block))
    )
  ) {
    throw new TypeError(
      `RawDraftContentState expects a valid "blocks" property, got: ${value}`,
    );
  }

  if (!isPlainObject(value.entityMap)) {
    throw new TypeError(
      `RawDraftContentState expects an "entityMap" property, got: ${value}`,
    );
  }

  return value as RawDraftContentState;
}

export const GraphQLDraftJS = new GraphQLScalarType({
  name: 'DraftJS',
  description:
    'The DraftJS raw state contains a list of content blocks, as well as a map of all relevant entity objects.',
  specifiedByUrl:
    'https://draftjs.org/docs/api-reference-data-conversion/#convertfromraw',
  serialize: (...args) =>
    ensureRawDraftContentStateValue(GraphQLJSONObject.serialize(...args)),
  parseValue: (...args) =>
    ensureRawDraftContentStateValue(GraphQLJSONObject.parseValue(...args)),
  parseLiteral: (...args) =>
    ensureRawDraftContentStateValue(GraphQLJSONObject.parseLiteral(...args)),
});
