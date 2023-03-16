import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Node, NodeChange } from '@prismamedia/graphql-platform';
import { MutationType } from '@prismamedia/graphql-platform-utils';
import {
  ArticleStatus,
  myAdminContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Delete statement', () => {
  let gp: MyGP;
  const changes: NodeChange[] = [];

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_delete_statement`);
    gp.on('node-change', (change) => changes.push(change));

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
        orderBy: ['createdAt_ASC'],
        first: 10,
        selection: '{ title }',
      },
      myAdminContext,
    ],
    [
      'Article',
      {
        where: { status: ArticleStatus.DRAFT },
        orderBy: ['createdAt_ASC'],
        first: 10,
        selection: '{ title }',
      },
      myAdminContext,
    ],
  ])('generates statements', async (nodeName, args, context) => {
    changes.length = 0;

    await expect(
      gp
        .getNodeByName(nodeName)
        .getMutationByKey('delete-many')
        .execute(args, context),
    ).resolves.toMatchSnapshot('result');

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
    ).toMatchSnapshot('changes');
  });
});
