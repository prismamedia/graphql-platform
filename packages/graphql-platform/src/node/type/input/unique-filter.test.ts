import { beforeAll, describe, expect, it } from '@jest/globals';
import { GraphQLInputObjectType, printType } from 'graphql';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
import {
  NodeUniqueFilterInputType,
  NodeUniqueFilterInputValue,
} from './unique-filter.js';

describe('NodeUniqueFilterInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has a unique filter input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const uniqueFilterInputType = node.uniqueFilterInputType;
      expect(uniqueFilterInputType).toBeInstanceOf(NodeUniqueFilterInputType);

      if (node.isPublic()) {
        expect(uniqueFilterInputType.getGraphQLInputType()).toBeInstanceOf(
          GraphQLInputObjectType,
        );
        expect(
          printType(uniqueFilterInputType.getGraphQLInputType()),
        ).toMatchSnapshot(uniqueFilterInputType.name);
      } else {
        expect(() => uniqueFilterInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}UniqueFilterInput" input type is private`,
        );
      }
    });
  });

  describe('Parser', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          { id_is_null: true },
          'Expects not to contain the extra key(s): id_is_null',
        ],
        ['Article', { id: null }, '/id - Expects a non-null "UUIDv4"'],
        ['Article', { id: 123 }, `/id - Expects an "UUIDv4", got: 123`],
        [
          'Article',
          { category: { parent: { title: null } }, slug: 'you-re-welcome' },
          '/category/parent - Expects not to contain the extra key(s): title',
        ],
      ])(
        '%sUniqueFilterInput.parseValue(%p) throws the error %p',
        (nodeName, value, error) => {
          const node = gp.getNodeByName(nodeName);
          const uniqueFilterInputType = node.uniqueFilterInputType;

          expect(() => uniqueFilterInputType.parseValue(value)).toThrowError(
            error,
          );
        },
      );
    });

    describe('Works', () => {
      it.each<[string, NodeUniqueFilterInputValue, NodeUniqueFilterInputValue]>(
        [
          ['Article', undefined, undefined],
          ['Article', null, null],
          ['Article', { _id: 123 }, { _id: 123 }],
          [
            'Article',
            { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
            { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
          ],
          [
            'Category',
            {
              parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' },
              order: 789,
            },
            {
              parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' },
              order: 789,
            },
          ],
          [
            'Category',
            { parent: null, slug: 'root' },
            { parent: null, slug: 'root' },
          ],
          [
            'Category',
            {
              parent: {
                _id: 999,
                slug: 'root',
                id: 'd038d5cf-815e-4f8d-8099-1def0bdec246',
              },
              order: 789,
            },
            {
              parent: {
                _id: 999,
              },
              order: 789,
            },
          ],
        ],
      )(
        '%sUniqueFilterInput.parseValue(%p) = %p',
        (nodeName, inputValue, parsedValue) => {
          const uniqueFilterInputType =
            gp.getNodeByName(nodeName).uniqueFilterInputType;

          expect(uniqueFilterInputType.parseValue(inputValue)).toEqual(
            parsedValue,
          );
        },
      );

      it.each<
        [
          string,
          NodeUniqueFilterInputValue,
          NodeUniqueFilterInputValue,
          boolean,
        ]
      >([
        ['Article', undefined, undefined, true],
        ['Article', null, null, true],
        ['Article', { _id: 123 }, { _id: 123 }, true],
        [
          'Category',
          { parent: null, order: 1 },
          { parent: null, order: 1 },
          true,
        ],
        [
          'Category',
          { parent: null, order: 1 },
          { parent: null, order: 2 },
          false,
        ],
        [
          'Category',
          { parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' }, order: 1 },
          { parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' }, order: 1 },
          true,
        ],
        [
          'Category',
          { parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' }, order: 1 },
          { parent: { id: '8db764c6-8a4d-492c-876e-7cfa2fdd455f' }, order: 1 },
          false,
        ],
      ])(
        '%sUniqueFilterInput.areValuesEqual(%p, %p) = %p',
        (nodeName, a, b, result) => {
          const uniqueFilterInputType =
            gp.getNodeByName(nodeName).uniqueFilterInputType;

          expect(uniqueFilterInputType.areValuesEqual(a, b)).toEqual(result);
        },
      );

      it.each<
        [
          string,
          ReadonlyArray<NodeUniqueFilterInputValue>,
          NodeUniqueFilterInputValue[],
        ]
      >([
        ['Article', [undefined, null, undefined, null], [undefined, null]],
        ['Article', [{ _id: 123 }], [{ _id: 123 }]],
        [
          'Category',
          [
            { parent: null, order: 1 },
            { parent: null, order: 2 },
            { parent: null, order: 1 },
          ],
          [
            { parent: null, order: 1 },
            { parent: null, order: 2 },
          ],
        ],
        [
          'Category',
          [
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 1,
            },
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 1,
            },
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 1,
            },
          ],
          [
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 1,
            },
          ],
        ],
        [
          'Category',
          [
            {
              parent: { id: '8db764c6-8a4d-492c-876e-7cfa2fdd455f' },
              order: 1,
            },
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 3,
            },
            {
              parent: { id: '8db764c6-8a4d-492c-876e-7cfa2fdd455f' },
              order: 1,
            },
          ],
          [
            {
              parent: { id: '8db764c6-8a4d-492c-876e-7cfa2fdd455f' },
              order: 1,
            },
            {
              parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
              order: 3,
            },
          ],
        ],
      ])(
        '%sUniqueFilterInput.uniqValues(%p) = %p',
        (nodeName, values, result) => {
          const uniqueFilterInputType =
            gp.getNodeByName(nodeName).uniqueFilterInputType;

          expect(uniqueFilterInputType.uniqValues(values)).toEqual(result);
        },
      );
    });
  });
});
