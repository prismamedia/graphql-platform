import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
} from 'draft-js';
import * as graphql from 'graphql';

export function parseRawDraftEntity(
  maybeRawDraftEntity: unknown,
  path?: utils.Path,
): RawDraftEntity {
  if (!utils.isPlainObject(maybeRawDraftEntity)) {
    throw new utils.UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftEntity,
      { path },
    );
  }

  if (
    typeof maybeRawDraftEntity.type !== 'string' ||
    !maybeRawDraftEntity.type
  ) {
    throw new utils.UnexpectedValueError(
      `a non-empty string`,
      maybeRawDraftEntity.type,
      { path: utils.addPath(path, 'type') },
    );
  }

  if (
    typeof maybeRawDraftEntity.mutability !== 'string' ||
    !maybeRawDraftEntity.mutability
  ) {
    throw new utils.UnexpectedValueError(
      `a non-empty string`,
      maybeRawDraftEntity.mutability,
      { path: utils.addPath(path, 'mutability') },
    );
  }

  if (!utils.isPlainObject(maybeRawDraftEntity.data)) {
    throw new utils.UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftEntity.data,
      { path: utils.addPath(path, 'data') },
    );
  }

  return maybeRawDraftEntity as RawDraftEntity;
}

export function parseRawDraftInlineStyleRange(
  maybeRawDraftInlineStyleRange: unknown,
  path?: utils.Path,
): RawDraftInlineStyleRange {
  if (!utils.isPlainObject(maybeRawDraftInlineStyleRange)) {
    throw new utils.UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftInlineStyleRange,
      { path },
    );
  }

  if (typeof maybeRawDraftInlineStyleRange.style !== 'string') {
    throw new utils.UnexpectedValueError(
      `a string`,
      maybeRawDraftInlineStyleRange.style,
      { path: utils.addPath(path, 'style') },
    );
  }

  if (!Number.isInteger(maybeRawDraftInlineStyleRange.offset)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftInlineStyleRange.offset,
      { path: utils.addPath(path, 'offset') },
    );
  }

  if (!Number.isInteger(maybeRawDraftInlineStyleRange.length)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftInlineStyleRange.length,
      { path: utils.addPath(path, 'length') },
    );
  }

  return maybeRawDraftInlineStyleRange as RawDraftInlineStyleRange;
}

export function parseRawDraftEntityRange(
  maybeRawDraftEntityRange: unknown,
  entityMap: RawDraftContentState['entityMap'],
  path?: utils.Path,
): RawDraftEntityRange {
  if (!utils.isPlainObject(maybeRawDraftEntityRange)) {
    throw new utils.UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftEntityRange,
      { path },
    );
  }

  if (!(maybeRawDraftEntityRange.key in entityMap)) {
    throw new utils.UnexpectedValueError(
      `a value among "${Object.keys(entityMap).join(', ')}"`,
      maybeRawDraftEntityRange.key,
      { path: utils.addPath(path, 'key') },
    );
  }

  if (!Number.isInteger(maybeRawDraftEntityRange.offset)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.offset,
      { path: utils.addPath(path, 'offset') },
    );
  }

  if (!Number.isInteger(maybeRawDraftEntityRange.length)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.length,
      { path: utils.addPath(path, 'length') },
    );
  }

  return maybeRawDraftEntityRange as RawDraftEntityRange;
}

export function parseRawDraftContentBlock(
  maybeRawDraftContentBlock: unknown,
  entityMap: RawDraftContentState['entityMap'],
  path?: utils.Path,
): RawDraftContentBlock {
  if (!utils.isPlainObject(maybeRawDraftContentBlock)) {
    throw new utils.UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftContentBlock,
      { path },
    );
  }

  if (
    typeof maybeRawDraftContentBlock.key !== 'string' ||
    !maybeRawDraftContentBlock.key
  ) {
    throw new utils.UnexpectedValueError(
      `a string`,
      maybeRawDraftContentBlock.key,
      { path: utils.addPath(path, 'key') },
    );
  }

  if (
    typeof maybeRawDraftContentBlock.type !== 'string' ||
    !maybeRawDraftContentBlock.type
  ) {
    throw new utils.UnexpectedValueError(
      `a string`,
      maybeRawDraftContentBlock.type,
      { path: utils.addPath(path, 'type') },
    );
  }

  if (typeof maybeRawDraftContentBlock.text !== 'string') {
    throw new utils.UnexpectedValueError(
      `a string`,
      maybeRawDraftContentBlock.text,
      { path: utils.addPath(path, 'text') },
    );
  }

  if (typeof maybeRawDraftContentBlock.depth !== 'number') {
    throw new utils.UnexpectedValueError(
      `a number`,
      maybeRawDraftContentBlock.depth,
      { path: utils.addPath(path, 'depth') },
    );
  }

  // inlineStyleRanges
  let inlineStyleRanges: RawDraftInlineStyleRange[];
  {
    const inlineStyleRangesPath = utils.addPath(path, 'inlineStyleRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.inlineStyleRanges)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftInlineStyleRange`,
        maybeRawDraftContentBlock.inlineStyleRanges,
        { path: inlineStyleRangesPath },
      );
    }

    inlineStyleRanges = utils.aggregateError<any, RawDraftInlineStyleRange[]>(
      maybeRawDraftContentBlock.inlineStyleRanges,
      (inlineStyleRanges, value, index) => [
        ...inlineStyleRanges,
        parseRawDraftInlineStyleRange(
          value,
          utils.addPath(inlineStyleRangesPath, index),
        ),
      ],
      [],
      { path: inlineStyleRangesPath },
    );
  }

  // entityRanges
  let entityRanges: RawDraftEntityRange[];
  {
    const entityRangesPath = utils.addPath(path, 'entityRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.entityRanges)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftEntityRange`,
        maybeRawDraftContentBlock.entityRanges,
        { path: entityRangesPath },
      );
    }

    entityRanges = utils.aggregateError<any, RawDraftEntityRange[]>(
      maybeRawDraftContentBlock.entityRanges,
      (entityRanges, value, index) => [
        ...entityRanges,
        parseRawDraftEntityRange(
          value,
          entityMap,
          utils.addPath(entityRangesPath, index),
        ),
      ],
      [],
      { path: entityRangesPath },
    );
  }

  // data
  let data: RawDraftContentBlock['data'];
  {
    if (maybeRawDraftContentBlock.data !== undefined) {
      if (utils.isPlainObject(maybeRawDraftContentBlock.data)) {
        data =
          Object.entries(maybeRawDraftContentBlock.data).length > 0
            ? maybeRawDraftContentBlock.data
            : undefined;
      } else if (Array.isArray(maybeRawDraftContentBlock.data)) {
        data =
          maybeRawDraftContentBlock.data.length > 0
            ? maybeRawDraftContentBlock.data
            : undefined;
      } else {
        throw new utils.UnexpectedValueError(
          `a plain object`,
          maybeRawDraftContentBlock.data,
          { path: utils.addPath(path, 'data') },
        );
      }
    }

    data = maybeRawDraftContentBlock.data;
  }

  return {
    key: maybeRawDraftContentBlock.key,
    type: maybeRawDraftContentBlock.type,
    text: maybeRawDraftContentBlock.text,
    depth: maybeRawDraftContentBlock.depth,
    inlineStyleRanges,
    entityRanges,
    ...(data !== undefined && { data }),
  } as RawDraftContentBlock;
}

export interface RawDraftContentState {
  entityMap: Record<string, RawDraftEntity> | RawDraftEntity[];
  blocks: RawDraftContentBlock[];
}

export function parseRawDraftContentState(
  maybeRawDraftContentState: unknown,
  path?: utils.Path,
): RawDraftContentState {
  if (!utils.isPlainObject(maybeRawDraftContentState)) {
    throw new utils.UnexpectedValueError(
      `a plain object`,
      maybeRawDraftContentState,
      { path },
    );
  }

  // entityMap
  let entityMap: RawDraftContentState['entityMap'];
  {
    const entityMapPath = utils.addPath(path, 'entityMap');

    if (utils.isPlainObject(maybeRawDraftContentState.entityMap)) {
      entityMap = utils.aggregateError<
        [string, RawDraftEntity],
        Record<string, RawDraftEntity>
      >(
        Object.entries(maybeRawDraftContentState.entityMap),
        (entityMap, [key, value]) =>
          Object.assign(entityMap, {
            [key]: parseRawDraftEntity(
              value,
              utils.addPath(entityMapPath, key),
            ),
          }),
        Object.create(null),
        { path: entityMapPath },
      );
    } else if (Array.isArray(maybeRawDraftContentState.entityMap)) {
      entityMap = utils.aggregateError<
        RawDraftEntity,
        Record<string, RawDraftEntity>
      >(
        maybeRawDraftContentState.entityMap,
        (entityMap, value, index) =>
          Object.assign(entityMap, {
            [index]: parseRawDraftEntity(
              value,
              utils.addPath(entityMapPath, index),
            ),
          }),
        Object.create(null),
        { path: entityMapPath },
      );
    } else {
      throw new utils.UnexpectedValueError(
        maybeRawDraftContentState.entityMap,
        `a RawDraftEntityMap or an array of RawDraftEntity`,
        { path: entityMapPath },
      );
    }
  }

  // blocks
  let blocks: RawDraftContentBlock[];
  {
    const blocksPath = utils.addPath(path, 'blocks');

    if (!Array.isArray(maybeRawDraftContentState.blocks)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftContentBlock`,
        maybeRawDraftContentState.blocks,
        { path: blocksPath },
      );
    }

    blocks = utils.aggregateError<any, RawDraftContentBlock[]>(
      maybeRawDraftContentState.blocks,
      (blocks, block, index) => [
        ...blocks,
        parseRawDraftContentBlock(
          block,
          entityMap,
          utils.addPath(blocksPath, index),
        ),
      ],
      [],
      { path: blocksPath },
    );
  }

  return {
    entityMap,
    blocks,
  };
}

export const GraphQLDraftJS = new graphql.GraphQLScalarType({
  name: 'DraftJS',
  description:
    'The DraftJS raw state contains a list of content blocks, as well as a map of all relevant entity objects.',
  specifiedByURL:
    'https://draftjs.org/docs/api-reference-data-conversion/#convertfromraw',
  parseValue(value: unknown) {
    return parseRawDraftContentState(value);
  },
  parseLiteral(ast, variables) {
    if (ast.kind === graphql.Kind.OBJECT) {
      return parseRawDraftContentState(
        graphql.valueFromASTUntyped(ast, variables),
      );
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseRawDraftContentState(value);
  },
});
