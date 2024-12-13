import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { MyGP, nodes } from '../__tests__/config.js';
import {
  AbstractDeletion,
  AbstractMutation,
  AbstractQuery,
  AbstractSubscription,
  GraphQLPlatform,
} from '../index.js';

describe('Operation', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('instanciates core-operations', () => {
    for (const node of gp.nodesByName.values()) {
      for (const mutation of node.operationsByType.mutation) {
        assert(mutation instanceof AbstractMutation);
        assert.strictEqual(typeof mutation.isEnabled(), 'boolean');
        assert.strictEqual(typeof mutation.isPublic(), 'boolean');
      }

      for (const query of node.operationsByType.query) {
        assert(query instanceof AbstractQuery);
        assert.strictEqual(query.isEnabled(), true);
        assert.strictEqual(typeof query.isPublic(), 'boolean');
      }

      for (const subscription of node.operationsByType.subscription) {
        assert(subscription instanceof AbstractSubscription);
        assert.strictEqual(typeof subscription.isEnabled(), 'boolean');
        assert.strictEqual(typeof subscription.isPublic(), 'boolean');
      }
    }
  });

  it('instanciates custom-operations', () => {
    const Article = gp.getNodeByName('Article');

    {
      const query = Article.getQueryByKey('custom');
      assert(query instanceof AbstractQuery);
      assert.strictEqual(query.name, 'customArticles');
      assert.strictEqual(query.isPublic(), true);
    }

    {
      const query = Article.getQueryByKey('customPrivate');
      assert(query instanceof AbstractQuery);
      assert.strictEqual(query.name, 'customPrivateArticles');
      assert.strictEqual(query.isPublic(), false);
    }

    {
      const mutation = Article.getMutationByKey('customDeletion');
      assert(mutation instanceof AbstractDeletion);
      assert.strictEqual(mutation.name, 'customDeletionArticles');
      assert.strictEqual(mutation.isPublic(), true);
    }
  });
});
