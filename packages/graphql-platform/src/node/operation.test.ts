import { beforeAll, describe, expect, it } from '@jest/globals';
import { MyGP, nodes } from '../__tests__/config.js';
import { GraphQLPlatform } from '../index.js';
import { AbstractMutation } from './operation/abstract-mutation.js';
import { AbstractQuery } from './operation/abstract-query.js';
import { AbstractSubscription } from './operation/abstract-subscription.js';

describe('Operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('are actually registered', () => {
    for (const node of gp.nodesByName.values()) {
      for (const mutation of node.operationsByType.mutation) {
        expect(mutation).toBeInstanceOf(AbstractMutation);
        expect(typeof mutation.isEnabled()).toBe('boolean');
        expect(typeof mutation.isPublic()).toBe('boolean');
      }

      for (const query of node.operationsByType.query) {
        expect(query).toBeInstanceOf(AbstractQuery);
        expect(query.isEnabled()).toBe(true);
        expect(typeof query.isPublic()).toBe('boolean');
      }

      for (const subscription of node.operationsByType.subscription) {
        expect(subscription).toBeInstanceOf(AbstractSubscription);
        expect(typeof subscription.isEnabled()).toBe('boolean');
        expect(typeof subscription.isPublic()).toBe('boolean');
      }
    }
  });
});
