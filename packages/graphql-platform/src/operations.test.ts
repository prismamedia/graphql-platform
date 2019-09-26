import { getObjectEntries } from '@prismamedia/graphql-platform-utils';
import { GraphQLPlatform } from '.';
import { operationConstructorMap } from './operations';
import { nodes } from './__tests__/config';

describe('Operations', () => {
  it.each(getObjectEntries(operationConstructorMap))(
    'the "%s" operation is registered',
    (operationKey, operationConstructor) => {
      const gp = new GraphQLPlatform({
        nodes,
      });

      expect(gp.nodeMap.size).toBeGreaterThan(0);

      for (const node of gp.nodeMap.values()) {
        expect(node.getOperation(operationKey)).toBeInstanceOf(
          operationConstructor,
        );
      }
    },
  );
});
