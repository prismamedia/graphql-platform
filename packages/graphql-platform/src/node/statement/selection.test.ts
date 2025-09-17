import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  ArticleStatus,
  createMyGP,
  myAdminContext,
} from '../../__tests__/config.js';
import type { RawNodeSelection } from '../../node.js';
import type { FlattenedNodeDependencyTreeJSON } from '../dependency.js';
import { OperationContext } from '../operation.js';

describe('Selection', () => {
  const gp = createMyGP();

  const Article = gp.getNodeByName('Article');

  describe('Definition', () => {
    (
      [
        [
          `{ title }`,
          {
            Article: {
              update: ['title'],
            },
          },
        ],
        [
          `{ title category { title order } }`,
          {
            Article: {
              update: ['title', 'category'],
            },
            Category: {
              update: ['order'],
            },
          },
        ],
        [
          `{ tagCount }`,
          {
            ArticleTag: {
              creation: true,
              deletion: true,
            },
          },
        ],
        [
          `{ tags(where: { tag: { deprecated_not: true }}, orderBy: [order_ASC], first: 10) { tag { slug }}}`,
          {
            ArticleTag: {
              creation: true,
              deletion: true,
              update: ['order'],
            },
            Tag: {
              update: ['deprecated', 'slug'],
            },
          },
        ],
      ] satisfies [RawNodeSelection, FlattenedNodeDependencyTreeJSON][]
    ).forEach(([input, expected]) => {
      it(`${input}.dependency = ${expected}`, () => {
        assert.deepEqual(
          Article.outputType.select(input).dependencyTree.flattened.toJSON(),
          expected,
        );
      });
    });
  });

  describe('Execution', () => {
    (
      [
        [
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: null,
            },
            b: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: null,
            },
          },
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: 'draft-my title',
            b: 'draft-my title',
          },
        ],
        [
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: { title: 'My category' },
            },
            b: {
              status: ArticleStatus.DRAFT,
              title: 'My title',
              category: { title: 'My category' },
            },
          },
          {
            id: '37da4d42-bc8d-4a01-98de-4d2109e09130',
            status: ArticleStatus.DRAFT,
            a: 'draft-my title-my category',
            b: 'draft-my title-my category',
          },
        ],
      ] as const
    ).forEach(([source, value]) => {
      it(`Parses & resolves`, async () => {
        const selection = Article.outputType.select(`{
          id
          status
          a: lowerCasedTitle
          b: lowerCasedTitle
        }`);

        assert.deepEqual(selection.parseSource(source), source);

        assert.deepEqual(
          await selection.resolveValue(
            source,
            new OperationContext(gp, myAdminContext),
          ),
          value,
        );
      });
    });
  });
});
