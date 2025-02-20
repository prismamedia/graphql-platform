import {
  ChangesSubscriptionDeletion,
  type ChangesSubscriptionChange,
  type ChangesSubscriptionStream,
} from '@prismamedia/graphql-platform';
import {
  ArticleStatus,
  myAdminContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createMyGP } from './__tests__/config.js';

describe('Subscription', () => {
  const gp = createMyGP(`connector_mariadb_subscription`);

  const Article = gp.getNodeByName('Article');
  const Category = gp.getNodeByName('Category');
  const Tag = gp.getNodeByName('Tag');
  const User = gp.getNodeByName('User');

  let subscriptions: ChangesSubscriptionStream[];

  beforeEach(async () => {
    await gp.connector.setup();

    subscriptions = await Promise.all([
      Article.api.subscribeToChanges(myAdminContext, {
        where: {
          status: ArticleStatus.PUBLISHED,
          tags_some: { tag: { deprecated_not: true } },
        },
        selection: {
          onUpsert: `{
            id
            title
            category {
              order
              title
            }
          }`,
          onDeletion: `{ id }`,
        },
      }),
      User.api.subscribeToChanges(myAdminContext, {
        where: {
          lastLoggedInAt_gte: '2025-01-01T00:00:00Z',
        },
        selection: {
          onUpsert: `{
            username
            createdArticles(first: 100) {
              id
              title
              tagCount(where: { tag: { deprecated: true }})
            }
          }`,
        },
      }),
    ]);

    await gp.seed(myAdminContext, fixtures.constant);

    await Article.api.updateMany(myAdminContext, {
      data: {
        slug: 'a-new-slug',
      },
      where: { title: fixtures.constant.Article.article_01.title },
      first: 10,
      selection: `{ id }`,
    });

    await User.api.createOne(myAdminContext, {
      data: {
        username: 'My new user',
      },
      selection: `{ id }`,
    });

    await User.api.createOne(myAdminContext, {
      data: {
        username: 'My second new user',
        lastLoggedInAt: new Date('2025-02-01T00:00:00Z'),
      },
      selection: `{ id }`,
    });

    await Category.api.updateOne(myAdminContext, {
      data: { order: 2 },
      where: { id: '26348235-ffe8-4ed1-985f-94e58961578f' },
      selection: `{ id }`,
    });

    await Tag.api.updateOne(myAdminContext, {
      data: { deprecated: true },
      where: { slug: 'tv' },
      selection: `{ id }`,
    });

    await gp.broker.assign();

    subscriptions.forEach((subscription) =>
      gp.broker.onIdle(subscription, () => subscription.dispose()),
    );
  });

  afterEach(async () => {
    await Promise.all(
      subscriptions.map((subscription) => subscription.dispose()),
    );
    await gp.connector.teardown();
  });

  it('has a dependency-graph', () => {
    assert.deepEqual(subscriptions[0].dependencyGraph.flattened.toJSON(), {
      Article: {
        creation: true,
        deletion: true,
        update: ['status', 'title', 'category'],
      },
      ArticleTag: {
        creation: true,
        deletion: true,
      },
      Category: {
        update: ['order'],
      },
      Tag: {
        update: ['deprecated'],
      },
    });

    assert.deepEqual(subscriptions[1].dependencyGraph.flattened.toJSON(), {
      Article: {
        creation: true,
        deletion: true,
        update: ['title'],
      },
      ArticleTag: {
        creation: true,
        deletion: true,
      },
      Tag: {
        update: ['deprecated'],
      },
      User: {
        creation: true,
        deletion: true,
        update: ['lastLoggedInAt'],
      },
    });
  });

  it('is iterable through "Array.fromAsync"', async () => {
    assert.deepEqual(
      await Array.fromAsync(subscriptions[0], (change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });

  it('is iterable through "for await"', async () => {
    const changes: ChangesSubscriptionChange[] = [];

    for await (const change of subscriptions[0]) {
      changes.push(change);
    }

    assert.deepEqual(
      changes.map((change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });

  it('is forEach-able', async () => {
    const changes: ChangesSubscriptionChange[] = [];

    await subscriptions[0].forEach((change) => changes.push(change));

    assert.deepEqual(
      changes.map((change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });

  it('is byBatch-able', async () => {
    const changes: ChangesSubscriptionChange[] = [];

    await subscriptions[0].byBatch((batch) => changes.push(...batch), {
      batchSize: 2,
    });

    assert.deepEqual(
      changes.map((change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });
});
