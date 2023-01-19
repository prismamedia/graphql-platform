import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
} from 'draft-js';
import * as entities from 'entities';
import * as graphql from 'graphql';

export type {
  RawDraftContentBlock,
  RawDraftEntity,
  RawDraftEntityRange,
  RawDraftInlineStyleRange,
};

export function parseRawDraftEntity(
  maybeRawDraftEntity: unknown,
  path?: utils.Path,
): RawDraftEntity {
  utils.assertPlainObject(maybeRawDraftEntity, path);

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
  utils.assertPlainObject(maybeRawDraftEntityRange, path);

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
  utils.assertPlainObject(maybeRawDraftContentBlock, path);

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

  if (!Number.isInteger(maybeRawDraftContentBlock.depth)) {
    throw new utils.UnexpectedValueError(
      `an integer`,
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

    inlineStyleRanges = utils.aggregateGraphError<
      any,
      RawDraftInlineStyleRange[]
    >(
      maybeRawDraftContentBlock.inlineStyleRanges,
      (inlineStyleRanges, value, index) => {
        inlineStyleRanges.push(
          parseRawDraftInlineStyleRange(
            value,
            utils.addPath(inlineStyleRangesPath, index),
          ),
        );

        return inlineStyleRanges;
      },
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

    entityRanges = utils.aggregateGraphError<any, RawDraftEntityRange[]>(
      maybeRawDraftContentBlock.entityRanges,
      (entityRanges, value, index) => {
        entityRanges.push(
          parseRawDraftEntityRange(
            value,
            entityMap,
            utils.addPath(entityRangesPath, index),
          ),
        );

        return entityRanges;
      },
      [],
      { path: entityRangesPath },
    );
  }

  // data
  let data: RawDraftContentBlock['data'];
  {
    const rawData = maybeRawDraftContentBlock.data;
    const rawDataPath = utils.addPath(path, 'data');

    if (rawData !== undefined) {
      if (utils.isPlainObject(rawData)) {
        data = Object.entries(rawData).length ? rawData : undefined;
      } else if (Array.isArray(rawData)) {
        data = rawData.length ? rawData : undefined;
      } else {
        utils.assertPlainObject(rawData, rawDataPath);
      }
    }
  }

  return Object.assign(Object.create(null), {
    key: maybeRawDraftContentBlock.key,
    type: maybeRawDraftContentBlock.type,
    text,
    depth: maybeRawDraftContentBlock.depth,
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
  let entityMap: RawDraftContentState['entityMap'] = Object.create(null);
  {
    if (maybeRawDraftContentState.entityMap != null) {
      const entityMapPath = utils.addPath(path, 'entityMap');

      if (utils.isPlainObject(maybeRawDraftContentState.entityMap)) {
        entityMap = utils.aggregateGraphError<
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
          entityMap,
          { path: entityMapPath },
        );
      } else if (Array.isArray(maybeRawDraftContentState.entityMap)) {
        entityMap = utils.aggregateGraphError<
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
          entityMap,
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

    blocks = utils.aggregateGraphError<any, RawDraftContentBlock[]>(
      maybeRawDraftContentState.blocks,
      (blocks, block, index) => {
        blocks.push(
          parseRawDraftContentBlock(
            block,
            entityMap,
            utils.addPath(blocksPath, index),
          ),
        );

        return blocks;
      },
      [],
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
