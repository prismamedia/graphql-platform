import { GraphQLPlatform } from '../..';
import { MyGP, nodes } from '../../__tests__/config';

describe('UpdateIfExists operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('calls the connector', async () => {});
});
