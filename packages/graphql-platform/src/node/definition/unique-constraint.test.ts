import assert from 'node:assert';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { nodes } from '../../__tests__/config.js';
import { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { UniqueConstraintValue } from './unique-constraint.js';

describe('Unique-constraint', () => {
  const gp = new GraphQLPlatform({ nodes });

  (
    [
      ['Article', '_id', { _id: 5 }, '{"_id":5}'],
      [
        'Article',
        'id',
        { id: '9cb3f464-5e35-4f2a-8b4d-82be4f8018e6' },
        '{"id":"9cb3f464-5e35-4f2a-8b4d-82be4f8018e6"}',
      ],
      [
        'Article',
        'category-slug',
        { category: null, slug: 'root' },
        '{"category":null,"slug":"root"}',
      ],
    ] satisfies ReadonlyArray<
      [Node['name'], string, UniqueConstraintValue, string]
    >
  ).forEach(
    ([
      nodeName,
      uniqueConstraintName,
      uniqueConstraintValue,
      stringifiedUniqueConstraintValue,
    ]) => {
      it(`"${nodeName}#${uniqueConstraintName}".stringify(${inspect(uniqueConstraintValue, undefined, 5)})`, () => {
        const node = gp.getNodeByName(nodeName);
        const uniqueConstraint =
          node.getUniqueConstraintByName(uniqueConstraintName);

        assert.deepEqual(
          uniqueConstraint.parseValue(uniqueConstraintValue),
          uniqueConstraintValue,
        );
        assert.strictEqual(
          uniqueConstraint.stringify(uniqueConstraintValue),
          stringifiedUniqueConstraintValue,
        );
      });
    },
  );
});
