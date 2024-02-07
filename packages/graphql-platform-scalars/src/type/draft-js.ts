import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
} from 'draft-js';
import * as entities from 'entities';
import * as graphql from 'graphql';
import { parseNonEmptyString } from './non-empty-string.js';

export type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
} from 'draft-js';

export function addRawDraftEntity<T extends RawDraftEntity>(
  entityMap: Record<string, RawDraftEntity>,
  entity: T,
): number {
  let key = 0;
  while (entityMap[key]) {
    key++;
  }

  entityMap[key] = entity;

  return key;
}

export function removeRawDraftEntity(
  content: RawDraftContentState,
  key: number | string,
): void {
  if (!content.entityMap[key]) {
    return;
  }

  delete content.entityMap[key];

  for (const block of content.blocks) {
    block.entityRanges = block.entityRanges.filter(
      (entityRange) =>
        // The equality is not strict because the object-key is a string and is a number in range
        entityRange.key != key,
    );
  }
}

export function parseRawDraftEntity(
  maybeRawDraftEntity: unknown,
  path?: utils.Path,
): RawDraftEntity {
  utils.assertPlainObject(maybeRawDraftEntity, path);

  parseNonEmptyString(maybeRawDraftEntity.type, utils.addPath(path, 'type'));

  parseNonEmptyString(
    maybeRawDraftEntity.mutability,
    utils.addPath(path, 'mutability'),
  );

  utils.assertPlainObject(
    maybeRawDraftEntity.data,
    utils.addPath(path, 'data'),
  );

  return maybeRawDraftEntity as RawDraftEntity;
}

export function parseRawDraftInlineStyleRange(
  maybeRawDraftInlineStyleRange: unknown,
  path?: utils.Path,
): RawDraftInlineStyleRange {
  utils.assertPlainObject(maybeRawDraftInlineStyleRange, path);

  if (
    typeof maybeRawDraftInlineStyleRange.style !== 'string' ||
    !maybeRawDraftInlineStyleRange.style
  ) {
    throw new utils.UnexpectedValueError(
      `a string`,
      maybeRawDraftInlineStyleRange.style,
      { path: utils.addPath(path, 'style') },
    );
  }

  if (!Number.isSafeInteger(maybeRawDraftInlineStyleRange.offset)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftInlineStyleRange.offset,
      { path: utils.addPath(path, 'offset') },
    );
  }

  if (!Number.isSafeInteger(maybeRawDraftInlineStyleRange.length)) {
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
  utils.assertPlainObject(maybeRawDraftEntityRange, path);

  if (!Number.isSafeInteger(maybeRawDraftEntityRange.key)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.key,
      { path: utils.addPath(path, 'key') },
    );
  } else if (!(maybeRawDraftEntityRange.key in entityMap)) {
    throw new utils.UnexpectedValueError(
      `a value among "${Object.keys(entityMap).join(', ')}"`,
      maybeRawDraftEntityRange.key,
      { path: utils.addPath(path, 'key') },
    );
  }

  if (!Number.isSafeInteger(maybeRawDraftEntityRange.offset)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
      maybeRawDraftEntityRange.offset,
      { path: utils.addPath(path, 'offset') },
    );
  }

  if (!Number.isSafeInteger(maybeRawDraftEntityRange.length)) {
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
  utils.assertPlainObject(maybeRawDraftContentBlock, path);

  const key = parseNonEmptyString(
    maybeRawDraftContentBlock.key,
    utils.addPath(path, 'key'),
  );

  const type = parseNonEmptyString(
    maybeRawDraftContentBlock.type,
    utils.addPath(path, 'type'),
  );

  // depth
  let depth: number;
  {
    if (!Number.isSafeInteger(maybeRawDraftContentBlock.depth)) {
      throw new utils.UnexpectedValueError(
        `an integer`,
        maybeRawDraftContentBlock.depth,
        { path: utils.addPath(path, 'depth') },
      );
    }

    depth = maybeRawDraftContentBlock.depth;
  }

  let text: string;
  {
    if (maybeRawDraftContentBlock.text != null) {
      if (typeof maybeRawDraftContentBlock.text !== 'string') {
        throw new utils.UnexpectedValueError(
          `a string`,
          maybeRawDraftContentBlock.text,
          { path: utils.addPath(path, 'text') },
        );
      }

      text = entities
        // Decodes entities, we target UTF-8
        .decodeHTMLStrict(maybeRawDraftContentBlock.text);
    } else {
      text = '';
    }
  }

  // inlineStyleRanges
  const inlineStyleRanges: RawDraftInlineStyleRange[] = [];
  {
    const inlineStyleRangesPath = utils.addPath(path, 'inlineStyleRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.inlineStyleRanges)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftInlineStyleRange`,
        maybeRawDraftContentBlock.inlineStyleRanges,
        { path: inlineStyleRangesPath },
      );
    }

    utils.aggregateGraphError<unknown, void>(
      maybeRawDraftContentBlock.inlineStyleRanges,
      (_, rawValue, index) =>
        inlineStyleRanges.push(
          parseRawDraftInlineStyleRange(
            rawValue,
            utils.addPath(inlineStyleRangesPath, index),
          ),
        ),
      undefined,
      { path: inlineStyleRangesPath },
    );
  }

  // entityRanges
  const entityRanges: RawDraftEntityRange[] = [];
  {
    const entityRangesPath = utils.addPath(path, 'entityRanges');

    if (!Array.isArray(maybeRawDraftContentBlock.entityRanges)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftEntityRange`,
        maybeRawDraftContentBlock.entityRanges,
        { path: entityRangesPath },
      );
    }

    utils.aggregateGraphError<unknown, void>(
      maybeRawDraftContentBlock.entityRanges,
      (_, rawValue, index) =>
        entityRanges.push(
          parseRawDraftEntityRange(
            rawValue,
            entityMap,
            utils.addPath(entityRangesPath, index),
          ),
        ),
      undefined,
      { path: entityRangesPath },
    );
  }

  // data
  let data: RawDraftContentBlock['data'];
  {
    const rawData = maybeRawDraftContentBlock.data;
    const rawDataPath = utils.addPath(path, 'data');

    if (rawData != null) {
      if (utils.isPlainObject(rawData)) {
        data = Object.keys(rawData).length ? rawData : undefined;
      } else if (Array.isArray(rawData)) {
        data = rawData.length ? rawData : undefined;
      } else {
        utils.assertPlainObject(rawData, rawDataPath);
      }
    }
  }

  return Object.assign(Object.create(null), {
    key,
    type,
    depth,
    text,
    inlineStyleRanges,
    entityRanges,
    ...(data && { data }),
  });
}

export interface RawDraftContentState {
  entityMap: Record<string, RawDraftEntity>;
  blocks: RawDraftContentBlock[];
}

export function parseRawDraftContentState(
  maybeRawDraftContentState: unknown,
  path?: utils.Path,
): RawDraftContentState {
  utils.assertPlainObject(maybeRawDraftContentState, path);

  // entityMap
  const entityMap: RawDraftContentState['entityMap'] = Object.create(null);
  {
    if (maybeRawDraftContentState.entityMap != null) {
      const entityMapPath = utils.addPath(path, 'entityMap');

      if (
        utils.isPlainObject(maybeRawDraftContentState.entityMap) ||
        Array.isArray(maybeRawDraftContentState.entityMap)
      ) {
        utils.aggregateGraphError<[number | string, unknown], void>(
          Object.entries(maybeRawDraftContentState.entityMap),
          (_, [rawKey, rawValue]) => {
            const entityPath = utils.addPath(entityMapPath, rawKey);

            const key =
              typeof rawKey === 'string' ? Number.parseInt(rawKey, 10) : rawKey;

            if (!Number.isSafeInteger(key)) {
              throw new utils.UnexpectedValueError(`an integer`, rawKey, {
                path: entityPath,
              });
            }

            entityMap[key] = parseRawDraftEntity(rawValue, entityPath);
          },
          undefined,
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
  }

  // blocks
  const blocks: RawDraftContentBlock[] = [];
  {
    const blocksPath = utils.addPath(path, 'blocks');

    if (!Array.isArray(maybeRawDraftContentState.blocks)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftContentBlock`,
        maybeRawDraftContentState.blocks,
        { path: blocksPath },
      );
    }

    utils.aggregateGraphError<unknown, void>(
      maybeRawDraftContentState.blocks,
      (_, rawBlock, index) =>
        blocks.push(
          parseRawDraftContentBlock(
            rawBlock,
            entityMap,
            utils.addPath(blocksPath, index),
          ),
        ),
      undefined,
      { path: blocksPath },
    );
  }

  return Object.assign(Object.create(null), {
    entityMap,
    blocks,
  });
}

export const GraphQLDraftJS = new graphql.GraphQLScalarType({
  name: 'DraftJS',
  description:
    'The DraftJS raw state contains a list of content blocks, as well as a map of all relevant entity objects.',
  specifiedByURL:
    'https://draftjs.org/docs/api-reference-data-conversion/#convertfromraw',
  parseValue(value) {
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
  serialize(value) {
    return parseRawDraftContentState(value);
  },
});

export function normalizeRawDraftContentBlock(
  maybeRawDraftContentBlock: unknown,
  entityMap: RawDraftContentState['entityMap'],
  path?: utils.Path,
): RawDraftContentBlock {
  utils.assertPlainObject(maybeRawDraftContentBlock, path);

  return parseRawDraftContentBlock(
    {
      ...maybeRawDraftContentBlock,
      entityRanges: Array.isArray(maybeRawDraftContentBlock.entityRanges)
        ? maybeRawDraftContentBlock.entityRanges.filter(
            (maybeRawDraftEntityRange: unknown) =>
              utils.isPlainObject(maybeRawDraftEntityRange) &&
              Number.isSafeInteger(maybeRawDraftEntityRange.key) &&
              maybeRawDraftEntityRange.key in entityMap,
          )
        : [],
    },
    entityMap,
    path,
  );
}

/**
 * Removes all the entities that are not used by the blocks & blocks' entity-ranges referencing inexistent entities
 */
export function normalizeRawDraftContentState(
  maybeRawDraftContentState: unknown,
  path?: utils.Path,
): RawDraftContentState | null {
  utils.assertPlainObject(maybeRawDraftContentState, path);

  // entityMap
  const entityMap: RawDraftContentState['entityMap'] = Object.create(null);
  {
    if (maybeRawDraftContentState.entityMap != null) {
      const entityMapPath = utils.addPath(path, 'entityMap');

      if (
        utils.isPlainObject(maybeRawDraftContentState.entityMap) ||
        Array.isArray(maybeRawDraftContentState.entityMap)
      ) {
        utils.aggregateGraphError<[number | string, unknown], void>(
          Object.entries(maybeRawDraftContentState.entityMap),
          (_, [rawKey, rawValue]) => {
            const entityPath = utils.addPath(entityMapPath, rawKey);

            const key =
              typeof rawKey === 'string' ? Number.parseInt(rawKey, 10) : rawKey;

            if (Number.isSafeInteger(key)) {
              entityMap[key] = parseRawDraftEntity(rawValue, entityPath);
            }
          },
          undefined,
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
  }

  // blocks
  const blocks: RawDraftContentBlock[] = [];
  {
    const blocksPath = utils.addPath(path, 'blocks');

    if (!Array.isArray(maybeRawDraftContentState.blocks)) {
      throw new utils.UnexpectedValueError(
        `an array of RawDraftContentBlock`,
        maybeRawDraftContentState.blocks,
        { path: blocksPath },
      );
    }

    utils.aggregateGraphError<unknown, void>(
      maybeRawDraftContentState.blocks,
      (_, rawBlock, index) =>
        blocks.push(
          normalizeRawDraftContentBlock(
            rawBlock,
            entityMap,
            utils.addPath(blocksPath, index),
          ),
        ),
      undefined,
      { path: blocksPath },
    );
  }

  return blocks.length
    ? {
        entityMap: Object.fromEntries(
          Object.entries(entityMap).filter(([key]) =>
            blocks.some((block) =>
              block.entityRanges.some(
                (entityRange) => String(entityRange.key) === key,
              ),
            ),
          ),
        ),
        blocks,
      }
    : null;
}
