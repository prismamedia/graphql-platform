import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import { NodeUpdateStatement } from './update.js';

describe('Update', () => {
  let gp: MyGP;

  before(() => {
    gp = createMyGP();
  });

  (
    [
      [
        'Article',
        {
          _id: 1,
          id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
          title: "My new article's title",
          slug: 'my-new-articles-title',
          body: null,
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: new Date('1987-04-28T00:00:00.000Z'),
          updatedBy: { username: 'yvann' },
          updatedAt: new Date('1987-04-28T00:00:00.000Z'),
          views: 0n,
          score: 0.5,
          metas: null,
          highlighted: null,
          sponsored: null,
          machineTags: null,
        },
        {
          title: "My new article's  title ",
        },
        {},
        {
          _id: 1,
          id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
          title: "My new article's title",
          slug: 'my-new-articles-title',
          body: null,
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: new Date('1987-04-28T00:00:00.000Z'),
          updatedBy: { username: 'yvann' },
          updatedAt: new Date('1987-04-28T00:00:00.000Z'),
          views: 0n,
          score: 0.5,
          metas: null,
          highlighted: null,
          sponsored: null,
          machineTags: null,
        },
      ],
      [
        'Article',
        {
          _id: 2,
          id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
          title: "My new article's title",
          slug: 'my-new-articles-title',
          body: null,
          status: ArticleStatus.DRAFT,
          category: { _id: 4 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: new Date('1987-04-28T00:00:00.000Z'),
          updatedBy: { username: 'yvann' },
          updatedAt: new Date('1987-04-28T00:00:00.000Z'),
          views: 0n,
          score: 0.5,
          metas: null,
          highlighted: null,
          sponsored: null,
          machineTags: null,
        },
        {
          // Same title
          title: "My new article's title",
          // New category
          category: { _id: 5 },
          // New updatedAt
          updatedAt: new Date('1987-04-28T12:00:00.000Z'),
        },
        {
          category: { _id: 5 },
          updatedAt: new Date('1987-04-28T12:00:00.000Z'),
        },
        {
          _id: 2,
          id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
          title: "My new article's title",
          slug: 'my-new-articles-title',
          body: null,
          status: ArticleStatus.DRAFT,
          category: { _id: 5 },
          createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
          createdAt: new Date('1987-04-28T00:00:00.000Z'),
          updatedBy: { username: 'yvann' },
          updatedAt: new Date('1987-04-28T12:00:00.000Z'),
          views: 0n,
          score: 0.5,
          metas: null,
          highlighted: null,
          sponsored: null,
          machineTags: null,
        },
      ],
    ] as const
  ).forEach(([nodeName, current, rawUpdate, update, target]) => {
    it(nodeName, () => {
      const node = gp.getNodeByName(nodeName);
      const statement = new NodeUpdateStatement(
        node,
        node.selection.parseSource(current),
        rawUpdate,
      );

      assert.deepEqual(statement.update, update);
      assert.deepEqual({ ...statement.updateProxy }, update);

      assert.deepEqual(statement.target, target);
      assert.deepEqual({ ...statement.targetProxy }, target);
    });
  });
});
