import assert from 'assert';
import { GraphQLPlatform } from '..';
import { nodes } from '../__tests__/config';
import { operationConstructorMap, TOperationKey } from './operations';

describe('Operations', () => {
  let gp: GraphQLPlatform<any, any>;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });

    assert(gp.nodeMap.size > 0);
  });

  it.each(Object.entries(operationConstructorMap))(
    'the "%s" operation is registered and enabled',
    (operationKey, OperationConstructor) => {
      for (const node of gp.nodeMap.values()) {
        const operation = node.getOperation(operationKey as TOperationKey);

        expect(operation).toBeInstanceOf(OperationConstructor);
        expect(operation.enabled).toBe(true);
      }
    },
  );
});
