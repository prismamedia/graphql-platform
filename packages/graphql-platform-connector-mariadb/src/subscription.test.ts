import {
  ChangesSubscriptionDeletion,
  type ChangesSubscriptionChange,
  type ChangesSubscriptionStream,
  type InMemoryBroker,
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
  const gp = createMyGP<InMemoryBroker, any>(`connector_mariadb_subscription`);
  let subscription: ChangesSubscriptionStream;

  beforeEach(async () => {
    await gp.connector.setup();

    const Article = gp.getNodeByName('Article');
    const Category = gp.getNodeByName('Category');
    const Tag = gp.getNodeByName('Tag');

    subscription = await Article.api.subscribeToChanges(myAdminContext, {
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
    });

    await gp.seed(myAdminContext, fixtures.constant);

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

    gp.broker.onIdle(subscription, () => subscription.dispose());
  });

  afterEach(async () => {
    await subscription.dispose();
    await gp.connector.teardown();
  });

  it('has a dependency-graph', () => {
    assert.deepEqual(subscription.dependencyGraph.summary.toJSON(), {
      componentsByNode: {
        Article: ['status', 'title', 'category'],
        Category: ['order'],
        Tag: ['deprecated'],
      },
      creations: ['Article', 'ArticleTag'],
      deletions: ['Article', 'ArticleTag'],
      changes: ['Article', 'ArticleTag', 'Category', 'Tag'],
    });
  });

  it('is iterable through "Array.fromAsync"', async () => {
    assert.deepEqual(
      await Array.fromAsync(subscription, (change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });

  it('is iterable through "for await"', async () => {
    const changes: ChangesSubscriptionChange[] = [];

    for await (const change of subscription) {
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

    await subscription.forEach((change) => changes.push(change));

    assert.deepEqual(
      changes.map((change) =>
        change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert',
      ),
      ['upsert', 'upsert', 'upsert', 'deletion'],
    );
  });

  it('is byBatch-able', async () => {
    const changes: ChangesSubscriptionChange[] = [];

    await subscription.byBatch((batch) => changes.push(...batch), {
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
