import { describe, expect, it } from '@jest/globals';
import { GraphQLPlatform } from '../../index.js';
import { nodes } from '../../__tests__/config.js';

describe('Unique-constraint', () => {
  const gp = new GraphQLPlatform({ nodes });

  it.each([
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
  ])(
    '"%s#%s".stringify(%p) = %s',
    (
      nodeName,
      uniqueConstraintName,
      uniqueConstraintValue,
      stringifiedUniqueConstraintValue,
    ) => {
      const node = gp.getNodeByName(nodeName);
      const uniqueConstraint =
        node.getUniqueConstraintByName(uniqueConstraintName);

      expect(uniqueConstraint.parseValue(uniqueConstraintValue)).toEqual(
        uniqueConstraintValue,
      );

      expect(uniqueConstraint.stringify(uniqueConstraintValue)).toBe(
        stringifiedUniqueConstraintValue,
      );
    },
  );
});
