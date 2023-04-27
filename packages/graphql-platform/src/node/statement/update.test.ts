import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  createMyGP,
  type MyGP,
} from '../../__tests__/config.js';
import { IndividualizedNodeUpdateStatement } from './update.js';

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
        title: "My new article's title",
        category: { _id: 5 },
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
  ])('works', (nodeName, current, update, actual, updated) => {
    const node = gp.getNodeByName(nodeName);
    const statement = new IndividualizedNodeUpdateStatement(
      node,
      update,
      current,
    );

    expect(statement.update).toEqual(actual);
    expect({ ...statement.updateProxy }).toEqual(actual);

    expect(statement.target).toEqual(updated);
    expect({ ...statement.targetProxy }).toEqual(updated);
  });
});
