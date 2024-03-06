import { beforeAll, describe, expect, it } from '@jest/globals';
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

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('instanciates core-operations', () => {
    for (const node of gp.nodesByName.values()) {
      for (const mutation of node.operationsByType.mutation) {
        expect(mutation).toBeInstanceOf(AbstractMutation);
        expect(typeof mutation.isEnabled()).toBe('boolean');
        expect(typeof mutation.isPublic()).toBe('boolean');
      }

      for (const query of node.operationsByType.query) {
        expect(query).toBeInstanceOf(AbstractQuery);
        expect(query.isEnabled()).toBeTruthy();
        expect(typeof query.isPublic()).toBe('boolean');
      }

      for (const subscription of node.operationsByType.subscription) {
        expect(subscription).toBeInstanceOf(AbstractSubscription);
        expect(typeof subscription.isEnabled()).toBe('boolean');
        expect(typeof subscription.isPublic()).toBe('boolean');
      }
    }
  });

  it('instanciates custom-operations', () => {
    const Article = gp.getNodeByName('Article');

    {
      const query = Article.getQueryByKey('custom');
      expect(query).toBeInstanceOf(AbstractQuery);
      expect(query.name).toEqual('customArticles');
      expect(query.isPublic()).toBeTruthy();
    }

    {
      const query = Article.getQueryByKey('customPrivate');
      expect(query).toBeInstanceOf(AbstractQuery);
      expect(query.name).toEqual('customPrivateArticles');
      expect(query.isPublic()).toBeFalsy();
    }

    {
      const mutation = Article.getMutationByKey('customDeletion');
      expect(mutation).toBeInstanceOf(AbstractDeletion);
      expect(mutation.name).toEqual('customDeletionArticles');
      expect(mutation.isPublic()).toBeTruthy();
    }
  });
});
