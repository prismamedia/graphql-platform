import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import { NodeCreationStatement } from './creation.js';

describe('Creation', () => {
  let gp: MyGP;

  before(() => {
    gp = createMyGP();
  });

  (
    [
      [
        'Article',
        {
          id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
          title: "My new article's title",
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: new Date('1987-04-28T00:00:00.000Z'),
          updatedBy: { username: 'yvann' },
          updatedAt: new Date('1987-04-28T00:00:00.000Z'),
          views: 0n,
          score: 0.5,
        },
      ],
    ] as const
  ).forEach(([nodeName, creation]) => {
    it(nodeName, () => {
      const node = gp.getNodeByName(nodeName);
      const statement = new NodeCreationStatement(node, creation);

      assert.deepEqual(statement.value, creation);
      assert.deepEqual({ ...statement.proxy }, creation);
    });
  });
});
