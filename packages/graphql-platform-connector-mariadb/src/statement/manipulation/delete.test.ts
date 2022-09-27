import { ChangedNode, Node } from '@prismamedia/graphql-platform';
import { MutationType } from '@prismamedia/graphql-platform-utils';
import {
  ArticleStatus,
  myAdminContext,
  MyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { MariaDBConnector } from '../../index.js';
import { makeGraphQLPlatform } from '../../__tests__/config.js';

describe('Delete statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('delete_statement');

    await gp.connector.setup();
    await gp.seed(fixtures, myAdminContext);
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it.each([
    [
      'Article',
      {
        where: { status: ArticleStatus.PUBLISHED },
        first: 5,
        selection: '{ title }',
      },
      myAdminContext,
    ],
    [
      'Article',
      {
        where: { status: ArticleStatus.DRAFT },
        first: 5,
        selection: '{ title }',
      },
      myAdminContext,
    ],
  ])('generates statements', async (nodeName, args, context) => {
    const changes: ChangedNode[] = [];

    const subscriber = gp.changes.subscribe((change) => {
      changes.push(change);
    });

    try {
      await expect(
        gp
          .getNodeByName(nodeName)
          .getMutationByKey('delete-many')
          .execute(args, context),
      ).resolves.toMatchSnapshot();
    } finally {
      subscriber.unsubscribe();
    }

    expect(
      changes.reduce<Map<Node['name'], Map<MutationType, number>>>(
        (changesByMutationTypeByNodeName, change) => {
          let changesByMutationType = changesByMutationTypeByNodeName.get(
            change.node.name,
          );

          if (!changesByMutationType) {
            changesByMutationTypeByNodeName.set(
              change.node.name,
              (changesByMutationType = new Map()),
            );
          }

          changesByMutationType.set(
            change.kind,
            (changesByMutationType.get(change.kind) ?? 0) + 1,
          );

          return changesByMutationTypeByNodeName;
        },
        new Map(),
      ),
    ).toMatchSnapshot();
  });
});
