import { GraphQLPlatform } from '..';
import { models, MyGP } from '../__tests__/config';
import { AbstractOperation } from './operations/abstract';

describe('Operations', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it('the operations are registered', () => {
    for (const model of gp.modelMap.values()) {
      for (const operation of Object.values(model.operationMap)) {
        expect(operation).toBeInstanceOf(AbstractOperation);
        expect(typeof operation.enabled).toBe('boolean');
        expect(typeof operation.public).toBe('boolean');
      }
    }
  });
});
