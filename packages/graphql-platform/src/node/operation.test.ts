import { beforeAll, describe, expect, it } from '@jest/globals';
import { GraphQLPlatform } from '../index.js';
import { MyGP, nodes } from '../__tests__/config.js';
import { AbstractMutation } from './operation/abstract-mutation.js';
import { AbstractQuery } from './operation/abstract-query.js';

describe('Operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('are actually registered', () => {
    for (const node of gp.nodesByName.values()) {
      for (const query of Object.values(node.queriesByKey)) {
        expect(query).toBeInstanceOf(AbstractQuery);
        expect(typeof query.isEnabled()).toBe('boolean');
        expect(typeof query.isPublic()).toBe('boolean');
      }

      for (const mutation of Object.values(node.mutationsByKey)) {
        expect(mutation).toBeInstanceOf(AbstractMutation);
        expect(typeof mutation.isEnabled()).toBe('boolean');
        expect(typeof mutation.isPublic()).toBe('boolean');
      }
    }
  });
});
