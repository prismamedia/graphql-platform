import {
  addPath,
  aggregateError,
  isPlainObject,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
} from 'draft-js';
import * as graphql from 'graphql';

export function parseRawDraftEntity(
  maybeRawDraftEntity: unknown,
  path?: Path,
): RawDraftEntity {
  if (!isPlainObject(maybeRawDraftEntity)) {
    throw new UnexpectedValueError(`a plain-object`, maybeRawDraftEntity, {
      path,
    });
  }

  if (
    typeof maybeRawDraftEntity.type !== 'string' ||
    !maybeRawDraftEntity.type
  ) {
    throw new UnexpectedValueError(
      `a non-empty string`,
      maybeRawDraftEntity.type,
      { path: addPath(path, 'type') },
    );
  }

  if (
    typeof maybeRawDraftEntity.mutability !== 'string' ||
    !maybeRawDraftEntity.mutability
  ) {
    throw new UnexpectedValueError(
      `a non-empty string`,
      maybeRawDraftEntity.mutability,
      { path: addPath(path, 'mutability') },
    );
  }

  if (!isPlainObject(maybeRawDraftEntity.data)) {
    throw new UnexpectedValueError(`a plain-object`, maybeRawDraftEntity.data, {
      path: addPath(path, 'data'),
    });
  }

  return maybeRawDraftEntity as RawDraftEntity;
}

export function parseRawDraftInlineStyleRange(
  maybeRawDraftInlineStyleRange: unknown,
  path?: Path,
): RawDraftInlineStyleRange {
  if (!isPlainObject(maybeRawDraftInlineStyleRange)) {
    throw new UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftInlineStyleRange,
      { path },
    );
  }

  if (typeof maybeRawDraftInlineStyleRange.style !== 'string') {
    throw new UnexpectedValueError(
      `a string`,
      maybeRawDraftInlineStyleRange.style,
      { path: addPath(path, 'style') },
    );
  }

  if (!Number.isInteger(maybeRawDraftInlineStyleRange.offset)) {
    throw new UnexpectedValueError(
      `an integer`,
      maybeRawDraftInlineStyleRange.offset,
      { path: addPath(path, 'offset') },
    );
  }

  if (!Number.isInteger(maybeRawDraftInlineStyleRange.length)) {
    throw new UnexpectedValueError(
      `an integer`,
      maybeRawDraftInlineStyleRange.length,
      { path: addPath(path, 'length') },
    );
  }

  return maybeRawDraftInlineStyleRange as RawDraftInlineStyleRange;
}

export function parseRawDraftEntityRange(
  maybeRawDraftEntityRange: unknown,
  entityMap: RawDraftContentState['entityMap'],
  path?: Path,
): RawDraftEntityRange {
  if (!isPlainObject(maybeRawDraftEntityRange)) {
    throw new UnexpectedValueError(`a plain-object`, maybeRawDraftEntityRange, {
      path,
    });
  }

  if (!(maybeRawDraftEntityRange.key in entityMap)) {
    throw new UnexpectedValueError(
      `a value among "${Object.keys(entityMap).join(', ')}"`,
      maybeRawDraftEntityRange.key,
      { path: addPath(path, 'key') },
    );
  }

  if (!Number.isInteger(maybeRawDraftEntityRange.offset)) {
    throw new UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.offset,
      { path: addPath(path, 'offset') },
    );
  }

  if (!Number.isInteger(maybeRawDraftEntityRange.length)) {
    throw new UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.length,
      { path: addPath(path, 'length') },
    );
  }

  return maybeRawDraftEntityRange as RawDraftEntityRange;
}

export function parseRawDraftContentBlock(
  maybeRawDraftContentBlock: unknown,
  entityMap: RawDraftContentState['entityMap'],
  path?: Path,
): RawDraftContentBlock {
  if (!isPlainObject(maybeRawDraftContentBlock)) {
    throw new UnexpectedValueError(
      `a plain-object`,
      maybeRawDraftContentBlock,
      { path },
    );
  }

  if (
    typeof maybeRawDraftContentBlock.key !== 'string' ||
    !maybeRawDraftContentBlock.key
  ) {
    throw new UnexpectedValueError(`a string`, maybeRawDraftContentBlock.key, {
      path: addPath(path, 'key'),
    });
  }

  if (
    typeof maybeRawDraftContentBlock.type !== 'string' ||
    !maybeRawDraftContentBlock.type
  ) {
    throw new UnexpectedValueError(`a string`, maybeRawDraftContentBlock.type, {
      path: addPath(path, 'type'),
    });
  }

  if (typeof maybeRawDraftContentBlock.text !== 'string') {
    throw new UnexpectedValueError(`a string`, maybeRawDraftContentBlock.text, {
      path: addPath(path, 'text'),
    });
  }

  if (typeof maybeRawDraftContentBlock.depth !== 'number') {
    throw new UnexpectedValueError(
      `a number`,
      maybeRawDraftContentBlock.depth,
      { path: addPath(path, 'depth') },
    );
  }

  // inlineStyleRanges
  let inlineStyleRanges: RawDraftInlineStyleRange[];
  {
    const inlineStyleRangesPath = addPath(path, 'inlineStyleRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.inlineStyleRanges)) {
      throw new UnexpectedValueError(
        `an array of RawDraftInlineStyleRange`,
        maybeRawDraftContentBlock.inlineStyleRanges,
        { path: inlineStyleRangesPath },
      );
    }

    inlineStyleRanges = aggregateError<any, RawDraftInlineStyleRange[]>(
      maybeRawDraftContentBlock.inlineStyleRanges,
      (inlineStyleRanges, value, index) => [
        ...inlineStyleRanges,
        parseRawDraftInlineStyleRange(
          value,
          addPath(inlineStyleRangesPath, index),
        ),
      ],
      [],
      { path: inlineStyleRangesPath },
    );
  }

  // entityRanges
  let entityRanges: RawDraftEntityRange[];
  {
    const entityRangesPath = addPath(path, 'entityRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.entityRanges)) {
      throw new UnexpectedValueError(
        `an array of RawDraftEntityRange`,
        maybeRawDraftContentBlock.entityRanges,
        { path: entityRangesPath },
      );
    }

    entityRanges = aggregateError<any, RawDraftEntityRange[]>(
      maybeRawDraftContentBlock.entityRanges,
      (entityRanges, value, index) => [
        ...entityRanges,
        parseRawDraftEntityRange(
          value,
          entityMap,
          addPath(entityRangesPath, index),
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
      if (isPlainObject(maybeRawDraftContentBlock.data)) {
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
        throw new UnexpectedValueError(
          `a plain object`,
          maybeRawDraftContentBlock.data,
          { path: addPath(path, 'data') },
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
  path?: Path,
): RawDraftContentState {
  if (!isPlainObject(maybeRawDraftContentState)) {
    throw new UnexpectedValueError(
      `a plain object`,
      maybeRawDraftContentState,
      { path },
    );
  }

  // entityMap
  let entityMap: RawDraftContentState['entityMap'];
  {
    const entityMapPath = addPath(path, 'entityMap');

    if (isPlainObject(maybeRawDraftContentState.entityMap)) {
      entityMap = aggregateError<
        [string, RawDraftEntity],
        Record<string, RawDraftEntity>
      >(
        Object.entries(maybeRawDraftContentState.entityMap),
        (entityMap, [key, value]) =>
          Object.assign(entityMap, {
            [key]: parseRawDraftEntity(value, addPath(entityMapPath, key)),
          }),
        Object.create(null),
        { path: entityMapPath },
      );
    } else if (Array.isArray(maybeRawDraftContentState.entityMap)) {
      entityMap = aggregateError<
        RawDraftEntity,
        Record<string, RawDraftEntity>
      >(
        maybeRawDraftContentState.entityMap,
        (entityMap, value, index) =>
          Object.assign(entityMap, {
            [index]: parseRawDraftEntity(value, addPath(entityMapPath, index)),
          }),
        Object.create(null),
        { path: entityMapPath },
      );
    } else {
      throw new UnexpectedValueError(
        maybeRawDraftContentState.entityMap,
        `a RawDraftEntityMap or an array of RawDraftEntity`,
        { path: entityMapPath },
      );
    }
  }

  // blocks
  let blocks: RawDraftContentBlock[];
  {
    const blocksPath = addPath(path, 'blocks');

    if (!Array.isArray(maybeRawDraftContentState.blocks)) {
      throw new UnexpectedValueError(
        `an array of RawDraftContentBlock`,
        maybeRawDraftContentState.blocks,
        { path: blocksPath },
      );
    }

    blocks = aggregateError<any, RawDraftContentBlock[]>(
      maybeRawDraftContentState.blocks,
      (blocks, block, index) => [
        ...blocks,
        parseRawDraftContentBlock(block, entityMap, addPath(blocksPath, index)),
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
    return parseRawDraftContentState(value, addPath(undefined, this.name));
  },
  parseLiteral(ast, variables) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.OBJECT) {
      return parseRawDraftContentState(
        graphql.valueFromASTUntyped(ast, variables),
        path,
      );
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseRawDraftContentState(value, addPath(undefined, this.name));
  },
});
