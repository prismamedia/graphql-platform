import { GraphQLPlatform } from '../..';
import { MyGP, nodes } from '../../__tests__/config';

describe('DeleteIfExists operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('calls the connector', async () => {});
});
