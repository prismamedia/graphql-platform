import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import { NodeUpdateStatement } from './update.js';

describe('Update', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP();
  });

  it.each([
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
      {
        title: "My new article's  title ",
      },
      {},
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
        id: '6a1dd2e7-7496-47aa-8575-282f45566d44',
        title: "My new article's title",
        status: ArticleStatus.DRAFT,
        category: { _id: 5 },
        createdBy: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
        createdAt: new Date('1987-04-28T00:00:00.000Z'),
        updatedBy: { username: 'yvann' },
        updatedAt: new Date('1987-04-28T12:00:00.000Z'),
        views: 0n,
        score: 0.5,
      },
    ],
  ])('works', (nodeName, current, rawUpdate, update, target) => {
    const node = gp.getNodeByName(nodeName);
    const statement = new NodeUpdateStatement(node, current, rawUpdate);

    expect(statement.update).toEqual(update);
    expect({ ...statement.updateProxy }).toEqual(update);

    expect(statement.target).toEqual(target);
    expect({ ...statement.targetProxy }).toEqual(target);
  });
});
