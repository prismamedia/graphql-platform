import { graphqlPlatform } from '.';
import complexMultiMutationRequest from './execution/complex-multi-mutation';
import complexMultiQueryRequest from './execution/complex-multi-query';

describe('Execution', () => {
  it('executes a complex multi query request', async done => {
    await expect(graphqlPlatform.execute(complexMultiQueryRequest)).resolves.toMatchSnapshot();

    done();
  });

  it('executes a complex multi mutation request', async done => {
    await expect(graphqlPlatform.execute(complexMultiMutationRequest)).resolves.toMatchSnapshot();

    done();
  });
});
