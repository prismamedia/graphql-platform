import complexMultiMutationRequest from './execution/complex-multi-mutation';
import complexMultiQueryRequest from './execution/complex-multi-query';
import { config, MyGP } from './gp';

describe('Execution', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new MyGP(config);
  });

  it('executes a complex multi query request', async done => {
    await expect(gp.execute(complexMultiQueryRequest)).resolves.toMatchSnapshot();

    done();
  });

  it('executes a complex multi mutation request', async done => {
    await expect(gp.execute(complexMultiMutationRequest)).resolves.toMatchSnapshot();

    done();
  });
});
