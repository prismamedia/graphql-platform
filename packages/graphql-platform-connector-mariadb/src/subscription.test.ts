import {
  ChangesSubscriptionDeletion,
  type ChangesSubscriptionChange,
  type ChangesSubscriptionStream,
} from '@prismamedia/graphql-platform';
import {
  ArticleStatus,
  myAdminContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import * as R from 'remeda';
import { createMyGP } from './__tests__/config.js';

describe('Subscription', () => {
  const gp = createMyGP(`connector_mariadb_subscription`);

  const Article = gp.getNodeByName('Article');
  const Category = gp.getNodeByName('Category');
  const Tag = gp.getNodeByName('Tag');

  let subscriptions: ChangesSubscriptionStream<MyContext>[];
  const additionalMutations = async () => {
    await gp.withMutationContext(
      { ...myAdminContext, action: 'additional mutations' },
      async ({ api }) => {
        await Promise.all([
          api.Article.updateMany({
            data: { slug: 'a-new-slug-1' },
            where: { title: fixtures.constant.Article.article_01.title },
            first: 1,
            selection: `{ id }`,
          }),
          api.Article.updateMany({
            data: { slug: 'a-new-slug-2' },
            where: { title: fixtures.constant.Article.article_02.title },
            first: 1,
            selection: `{ id }`,
          }),
          api.Article.updateMany({
            data: { slug: 'a-new-slug-3' },
            where: { title: fixtures.constant.Article.article_03.title },
            first: 1,
            selection: `{ id }`,
          }),
        ]);

        await api.User.createOne({
          data: { username: 'My new user' },
          selection: `{ id }`,
        });

        await api.User.createOne({
          data: {
            username: 'My second new user',
            lastLoggedInAt: new Date('2025-02-01T00:00:00Z'),
          },
          selection: `{ id }`,
        });

        await api.Category.updateOne({
          data: { order: 2 },
          where: { id: '26348235-ffe8-4ed1-985f-94e58961578f' },
          selection: `{ id }`,
        });
      },
    );

    await Tag.api.updateOne(
      { ...myAdminContext, action: '"TV" tag deprecation' },
      {
        data: { deprecated: true },
        where: { slug: 'tv' },
        selection: `{ id }`,
      },
    );

    await gp.broker.assign();
  };

  beforeEach(async () => {
    await gp.connector.setup();

    subscriptions = await Promise.all([
      Article.api.subscribeToChanges(myAdminContext, {
        where: {
          status: ArticleStatus.PUBLISHED,
          tags_some: { tag: { deprecated_not: true } },
        },
        cursor: { orderBy: '_id_DESC', size: 25 },
        selection: {
          onUpsert: `{
            id
            slug
            title
            category {
              order
              title
            }
          }`,
          onDeletion: `{
            id
            slug
          }`,
        },
      }),
      Tag.api.subscribeToChanges(myAdminContext, {
        where: { deprecated_not: true },
        selection: {
          onUpsert: `{
            title
            deprecated
            articleCount(where: { article: { status: "${ArticleStatus.PUBLISHED}"}})
          }`,
        },
      }),
      Category.api.subscribeToChanges(myAdminContext, {
        where: { order_gt: 0 },
        selection: {
          onUpsert: `{
            id
            order
            slug
            title
          }`,
        },
      }),
    ]);

    await gp.seed(
      { ...myAdminContext, action: 'fixtures seeding' },
      fixtures.constant,
    );

    await gp.broker.assign();

    let hasBeenIdle = false;
    subscriptions.forEach((subscription) =>
      gp.broker.onIdle(subscription, async () => {
        if (!hasBeenIdle) {
          hasBeenIdle = true;

          await additionalMutations();
        } else {
          subscription.dispose();
        }
      }),
    );
  });

  afterEach(async () => {
    await Promise.all(
      subscriptions.map((subscription) => subscription.dispose()),
    );
    await gp.connector.teardown();
  });

  describe('has consistent dependency-trees', () => {
    it('articles', () => {
      assert.deepEqual(subscriptions[0].dependencyTree.flattened.toJSON(), {
        Article: {
          creation: true,
          deletion: true,
          update: ['status', 'slug', 'title', 'category'],
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
    });

    it('tags', () => {
      assert.deepEqual(subscriptions[1].dependencyTree.flattened.toJSON(), {
        Article: {
          update: ['status'],
        },
        ArticleTag: {
          creation: true,
          deletion: true,
        },
        Tag: {
          creation: true,
          deletion: true,
          update: ['deprecated', 'title'],
        },
      });
    });

    it('categories', () => {
      assert.deepEqual(subscriptions[2].dependencyTree.flattened.toJSON(), {
        Category: {
          creation: true,
          deletion: true,
          update: ['order'],
        },
      });
    });
  });

  it('has diagnosis', async () => {
    assert.deepEqual(
      (await gp.broker.diagnose()).map(({ assigned, unassigned }) => ({
        assigned:
          assigned.mutationCount &&
          R.omit(assigned, [
            'oldestCommitDate',
            'newestCommitDate',
            'latencyInSeconds',
          ]),
        unassigned:
          unassigned.mutationCount &&
          R.omit(unassigned, [
            'oldestCommitDate',
            'newestCommitDate',
            'latencyInSeconds',
          ]),
      })),
      [
        {
          assigned: {
            mutationCount: 1,
            changeCount: 15,
          },
          unassigned: 0,
        },
        {
          assigned: {
            mutationCount: 1,
            changeCount: 11,
          },
          unassigned: 0,
        },
        {
          assigned: {
            mutationCount: 1,
            changeCount: 3,
          },
          unassigned: 0,
        },
      ],
    );

    await additionalMutations();

    assert.deepEqual(
      (await gp.broker.diagnose()).map(({ assigned, unassigned }) => ({
        assigned:
          assigned.mutationCount &&
          R.omit(assigned, [
            'oldestCommitDate',
            'newestCommitDate',
            'latencyInSeconds',
          ]),
        unassigned:
          unassigned.mutationCount &&
          R.omit(unassigned, [
            'oldestCommitDate',
            'newestCommitDate',
            'latencyInSeconds',
          ]),
      })),
      [
        {
          assigned: {
            mutationCount: 3,
            changeCount: 20,
          },
          unassigned: 0,
        },
        {
          assigned: {
            mutationCount: 2,
            changeCount: 12,
          },
          unassigned: 0,
        },
        {
          assigned: {
            mutationCount: 2,
            changeCount: 4,
          },
          unassigned: 0,
        },
      ],
    );
  });

  it("throws on forEach's callback synchronous error", async () => {
    let originalError: Error | undefined;

    await assert.rejects(
      () =>
        subscriptions[0].forEach(
          (_value, _signal) => {
            throw (originalError = new Error('Synchronous error'));
          },
          { concurrency: 2 },
        ),
      originalError,
    );

    assert(originalError);
  });

  it("throws on forEach's callback asynchronous error", async () => {
    let originalError: Error | undefined;

    await assert.rejects(
      () =>
        subscriptions[0].forEach(
          async (_value, signal) => {
            await setTimeout(25, undefined, { signal });

            throw (originalError = new Error('Asynchronous error'));
          },
          { concurrency: 2 },
        ),
      originalError,
    );

    assert(originalError);
  });

  it("throws on byBatch's callback synchronous error", async () => {
    let originalError: Error | undefined;

    await assert.rejects(
      () =>
        subscriptions[0].byBatch(
          (_values, _signal) => {
            throw (originalError = new Error('Synchronous error'));
          },
          { concurrency: 2 },
        ),
      originalError,
    );

    assert(originalError);
  });

  it("throws on byBatch's callback asynchronous error", async () => {
    let originalError: Error | undefined;

    await assert.rejects(
      () =>
        subscriptions[0].byBatch(
          async (_values, signal) => {
            await setTimeout(25, undefined, { signal });

            throw (originalError = new Error('Asynchronous error'));
          },
          { concurrency: 2 },
        ),
      originalError,
    );

    assert(originalError);
  });

  it('is iterable through "Array.fromAsync"', async () => {
    assert.deepEqual(
      await Array.fromAsync(
        subscriptions[0],
        (change) =>
          `${change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert'}:${change.value.slug}${change.initiator.action ? ` - ${change.initiator.action}` : ''}`,
      ),
      [
        'deletion:my-second-published-article - fixtures seeding',
        'upsert:my-second-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article - fixtures seeding',
        'upsert:a-new-slug-3 - additional mutations',
        'deletion:my-second-published-article-in-root-category - "TV" tag deprecation',
      ],
    );
  });

  it('is iterable through "for await"', async () => {
    const changes: ChangesSubscriptionChange<MyContext>[] = [];

    for await (const change of subscriptions[0]) {
      changes.push(change);
    }

    assert.deepEqual(
      changes.map(
        (change) =>
          `${change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert'}:${change.value.slug}${change.initiator.action ? ` - ${change.initiator.action}` : ''}`,
      ),
      [
        'deletion:my-second-published-article - fixtures seeding',
        'upsert:my-second-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article - fixtures seeding',
        'upsert:a-new-slug-3 - additional mutations',
        'deletion:my-second-published-article-in-root-category - "TV" tag deprecation',
      ],
    );
  });

  it('is iterable through "for await" untill break', async () => {
    const changes: ChangesSubscriptionChange<MyContext>[] = [];

    for await (const change of subscriptions[0]) {
      changes.push(change);

      break;
    }

    assert.deepEqual(
      changes.map(
        (change) =>
          `${change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert'}:${change.value.slug}${change.initiator.action ? ` - ${change.initiator.action}` : ''}`,
      ),
      ['deletion:my-second-published-article - fixtures seeding'],
    );
  });

  it('is forEach-able', async () => {
    const changes: ChangesSubscriptionChange<MyContext>[] = [];

    await subscriptions[0].forEach((change) => changes.push(change));

    assert.deepEqual(
      changes.map(
        (change) =>
          `${change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert'}:${change.value.slug}${change.initiator.action ? ` - ${change.initiator.action}` : ''}`,
      ),
      [
        'deletion:my-second-published-article - fixtures seeding',
        'upsert:my-second-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article - fixtures seeding',
        'upsert:a-new-slug-3 - additional mutations',
        'deletion:my-second-published-article-in-root-category - "TV" tag deprecation',
      ],
    );
  });

  it('is byBatch-able', async () => {
    const changes: ChangesSubscriptionChange<MyContext>[] = [];

    await subscriptions[0].byBatch((batch) => changes.push(...batch), {
      batchSize: 2,
    });

    assert.deepEqual(
      changes.map(
        (change) =>
          `${change instanceof ChangesSubscriptionDeletion ? 'deletion' : 'upsert'}:${change.value.slug}${change.initiator.action ? ` - ${change.initiator.action}` : ''}`,
      ),
      [
        'deletion:my-second-published-article - fixtures seeding',
        'upsert:my-second-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article-in-root-category - fixtures seeding',
        'upsert:my-first-published-article - fixtures seeding',
        'upsert:a-new-slug-3 - additional mutations',
        'deletion:my-second-published-article-in-root-category - "TV" tag deprecation',
      ],
    );
  });
});
