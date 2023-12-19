import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ChangesSubscriptionDeletion,
  type ChangesSubscriptionChange,
  type InMemoryBroker,
} from '@prismamedia/graphql-platform';
import {
  ArticleStatus,
  myAdminContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { createMyGP, type MyGP } from './__tests__/config.js';

describe('Subscription', () => {
  let gp: MyGP<InMemoryBroker>;

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_subscription`);

    await gp.connector.setup();
  });

  afterAll(() => gp.connector.teardown());

  it('works', async () => {
    const Article = gp.getNodeByName('Article');
    const Category = gp.getNodeByName('Category');
    const Tag = gp.getNodeByName('Tag');

    const subscription = Article.api.subscribeToChanges(myAdminContext, {
      where: {
        status: ArticleStatus.PUBLISHED,
        category: { parent: null, slug: 'root' },
        tags_some: { tag: { deprecated_not: true } },
      },
      selection: {
        onUpsert: `{
          id
          title
          category {
            title
          }
          tags(
            where: { tag: { deprecated_not: true } },
            orderBy: [order_ASC],
            first: 10
          ) {
            tag {
              title
            }
          }
          lowerCasedTitle
        }`,
        onDeletion: `{ id }`,
      },
    });

    await subscription.initialize();

    await gp.seed(myAdminContext, fixtures.constant);

    await Article.api.createSome(myAdminContext, {
      data: [
        {
          id: 'cad26ef0-4609-4d2a-87e2-76f38a51d381',
          title: 'My article 05',
          status: ArticleStatus.PUBLISHED,
        },
        {
          id: 'e6a610d4-bd4e-498b-9f26-705c8e42371a',
          title: 'My article 06',
          status: ArticleStatus.DELETED,
        },
        {
          id: '534bb8ae-9801-4b73-aad0-5095781585cf',
          title: 'My article 07',
          status: ArticleStatus.DRAFT,
        },
        {
          id: '736de572-36f6-4ac8-a3df-00e6e4ed7600',
          title: 'My article 08',
          status: ArticleStatus.PUBLISHED,
          category: { connect: { parent: null, slug: 'root' } },
          tags: { create: { order: 0, tag: { connect: { slug: 'tv' } } } },
        },
      ],
      selection: `{ id }`,
    });

    await Promise.all([
      Article.api.updateOne(myAdminContext, {
        data: { status: ArticleStatus.DRAFT },
        where: { id: 'cad26ef0-4609-4d2a-87e2-76f38a51d381' },
        selection: `{ id }`,
      }),
      Article.api.updateOne(myAdminContext, {
        data: { status: ArticleStatus.PUBLISHED },
        where: { id: '534bb8ae-9801-4b73-aad0-5095781585cf' },
        selection: `{ id }`,
      }),
    ]);

    await Category.api.updateOne(myAdminContext, {
      data: { order: 2 },
      where: { parent: { _id: 1 }, order: 1 },
      selection: `{ id }`,
    });

    await Tag.api.updateOne(myAdminContext, {
      data: { deprecated: true },
      where: { slug: 'tv' },
      selection: `{ id }`,
    });

    await gp.broker.onSubscriptionIdle(subscription);

    const changes: ChangesSubscriptionChange[] = [];
    for await (const change of subscription) {
      changes.push(change);

      if (subscription.isQueueEmpty()) {
        break;
      }
    }

    expect(changes.length).toBe(6);
    expect(
      changes.map(
        (change) =>
          `${change.subscription.node}.${
            change instanceof ChangesSubscriptionDeletion
              ? 'deletion'
              : 'upsert'
          }`,
      ),
    ).toMatchInlineSnapshot(`
      [
        "Article.upsert",
        "Article.upsert",
        "Article.upsert",
        "Article.deletion",
        "Article.deletion",
        "Article.deletion",
      ]
    `);

    await subscription.dispose();
  });
});
